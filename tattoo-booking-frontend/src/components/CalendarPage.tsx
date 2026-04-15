/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowserClient";
import { useRequireArtistProfile } from "@/hooks/useRequireAdmin";
import { type SlotStatus, normalizeSlotStatus } from "@/lib/domain";
import { startOfDayLocal, getMonthMatrix, toIsoLocal } from "@/lib/calendarUtils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, RefreshCw, Trash2, Settings, LogOut, LayoutDashboard } from "lucide-react";

type Slot = {
  slot_id: string;
  start_time: string; // timestamptz
  end_time: string;   // timestamptz
  status: SlotStatus | null;
  created_at?: string;
  updated_at?: string;
};

type ViewMode = "month" | "week";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];


interface CalendarPageProps {
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export default function CalendarPage({ onNavigate, onLogout }: CalendarPageProps) {
  const checking = useRequireArtistProfile();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const didInitialLoad = useRef(false);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // mobile tab: "calendar" | "availability"
  const [mobileTab, setMobileTab] = useState<"calendar" | "availability">("calendar");

  // view state (Figma-like)
  const [view, setView] = useState<ViewMode>("month");
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  // sidebar inputs
  const [selDate, setSelDate] = useState<string>(() => {
    const y = today.getFullYear();
    const m = `${today.getMonth() + 1}`.padStart(2, "0");
    const d = `${today.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const [startTime, setStartTime] = useState<string>("10:00");
  const [endTime, setEndTime] = useState<string>("11:00");
  const [notes, setNotes] = useState<string>("");

  const fetchSlots = async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const { data: rows, error } = await supabase
        .from("slot")
        .select("*")
        .order("start_time", { ascending: true });

      if (error) toast.error(error.message);
      else {
        setSlots(
          ((rows as Slot[]) ?? []).map((slot) => ({
            ...slot,
            status: normalizeSlotStatus(slot.status),
          })),
        );
        if (showSpinner) toast.success("Calendar refreshed.");
      }
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  };

  // initial load
  useEffect(() => {
    if (checking || didInitialLoad.current) return;
    didInitialLoad.current = true;
    fetchSlots();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking]);

  const monthMatrix = useMemo(
    () => getMonthMatrix(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  );

  const slotsByDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const d = startOfDayLocal(new Date(s.start_time));
      const key = d.toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    // sort inside each day
    map.forEach((arr) => arr.sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time)));
    return map;
  }, [slots]);

  const currentMonth = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });

  async function addSlot() {
    if (!selDate || !startTime || !endTime) {
      toast.error("Pick a date, start and end time.");
      return;
    }
    const stIso = toIsoLocal(selDate, startTime);
    const enIso = toIsoLocal(selDate, endTime);
    if (new Date(enIso) <= new Date(stIso)) {
      toast.error("End time must be after start time.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        start_time: stIso,
        end_time: enIso,
        status: "available" as const,
        // notes not in schema; ignore for now
      };

      const { data, error } = await supabase
        .from("slot")
        .insert(payload)
        .select()
        .maybeSingle();

      if (error) throw error;

      setSlots((prev) => {
        if (data) return [...prev, data as Slot].sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
        return prev;
      });
      toast.success("Availability added.");
    } catch (e: any) {
      toast.error(e.message || "Failed to add slot.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSlot(slotId: string) {
    try {
      const { error } = await supabase.from("slot").delete().eq("slot_id", slotId);
      if (error) throw error;
      setSlots((prev) => prev.filter((s) => s.slot_id !== slotId));
      toast.success("Availability deleted.");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete slot.");
    }
  }

  // status -> chip styles (matches your legend colors)
  function statusClasses(status?: string | null) {
    switch (status) {
      case "available":
        return "bg-green-700/80 text-green-50 border border-green-600";
      case "booked":
        return "bg-yellow-700/80 text-yellow-50 border border-yellow-600";
      case "blocked":
        return "bg-red-800/80 text-red-50 border border-red-700";
      case "completed":
        return "bg-blue-800/80 text-blue-50 border border-blue-700";
      case "cancelled":
        return "bg-neutral-700/80 text-neutral-100 border border-neutral-600";
      default:
        return "bg-neutral-800/80 text-neutral-200 border border-neutral-700";
    }
  }

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Failed to log out. Please try again.");
      return;
    }
    toast.success("Logged out successfully");
    onLogout();
  };

  if (checking) return null;

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-[#e5e5e5] overflow-hidden">
      {/* Top Navigation */}
      <div className="shrink-0 border-b border-[rgba(255,255,255,0.1)] bg-[#1a1a1a] z-50 shadow-lg shadow-black/20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="hidden sm:block">MissMay Calendar</h1>
          <div className="flex gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onNavigate("dashboard")}
              className="text-[#e5e5e5] hover:text-[#a32020] hover:bg-[#a32020]/10 sm:w-auto sm:px-4"
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="hidden sm:inline ml-2">Dashboard</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onNavigate("settings")}
              className="text-[#e5e5e5] hover:text-[#a32020] hover:bg-[#a32020]/10 sm:w-auto sm:px-4"
            >
              <Settings className="w-5 h-5" />
              <span className="hidden sm:inline ml-2">Settings</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-[#e5e5e5] hover:text-[#a32020] hover:bg-[#a32020]/10 sm:w-auto sm:px-4"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline ml-2">Logout</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile tab bar — hidden on desktop */}
      <div className="shrink-0 lg:hidden flex border-b border-white/10 bg-[#121212]">
        <button
          onClick={() => setMobileTab("calendar")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            mobileTab === "calendar"
              ? "text-white border-b-2 border-[#a32020]"
              : "text-neutral-400"
          }`}
        >
          Calendar
        </button>
        <button
          onClick={() => setMobileTab("availability")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            mobileTab === "availability"
              ? "text-white border-b-2 border-[#a32020]"
              : "text-neutral-400"
          }`}
        >
          Availability
          {slots.length > 0 && (
            <span className="ml-1.5 text-[10px] bg-[#a32020] text-white rounded-full px-1.5 py-0.5">
              {slots.length}
            </span>
          )}
        </button>
      </div>

      {/* Page content — fills remaining viewport height */}
      <div className="flex-1 min-h-0 flex flex-col p-3 lg:p-4 gap-3 max-w-[1400px] w-full mx-auto">
        {/* Desktop header (hidden on mobile — tabs replace it) */}
        <div className="shrink-0 hidden lg:flex items-center justify-between">
          <h1 className="text-xl">Calendar</h1>
          <div className="flex gap-2">
            <Button
              variant={view === "week" ? "secondary" : "default"}
              className={view === "week" ? "bg-neutral-800" : "bg-[#a32020] hover:bg-[#8a1b1b]"}
              onClick={() => setView("week")}
            >
              Week
            </Button>
            <Button
              variant={view === "month" ? "secondary" : "default"}
              className={view === "month" ? "bg-[#a32020] hover:bg-[#8a1b1b]" : "bg-neutral-800"}
              onClick={() => setView("month")}
            >
              Month
            </Button>
          </div>
        </div>

        {/* Main panels — side by side on desktop, tab-switched on mobile */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">

          {/* Calendar panel */}
          <div className={`min-h-0 flex flex-col bg-[#121212] rounded-lg border border-white/10 p-3 lg:p-4 ${
            mobileTab !== "calendar" ? "hidden lg:flex" : "flex"
          }`}>
            {/* Month nav */}
            <div className="shrink-0 flex items-center justify-between mb-2">
              <div className="font-medium">{currentMonth}</div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => fetchSlots(true)}
                  disabled={refreshing}
                  title="Refresh calendar"
                  className="text-neutral-400 hover:text-[#e5e5e5]"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Day labels */}
            <div className="shrink-0 grid grid-cols-7 text-center text-xs text-neutral-400 mb-1">
              {DAY_LABELS.map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>

            {/* Month grid — expands to fill panel */}
            <div className="flex-1 min-h-0 grid grid-cols-7 grid-rows-6 gap-1">
              {monthMatrix.flat().map((day, idx) => {
                const isThisMonth = day.getMonth() === cursor.getMonth();
                const key = startOfDayLocal(day).toDateString();
                const items = slotsByDay.get(key) || [];
                return (
                  <div
                    key={`${key}-${idx}`}
                    className={`rounded-md p-1 lg:p-1.5 min-h-0 overflow-hidden border ${
                      isThisMonth ? "border-white/10" : "border-white/5 opacity-50"
                    } bg-black/30 flex flex-col`}
                  >
                    <div className="text-[11px] text-neutral-400 leading-none mb-1 shrink-0">{day.getDate()}</div>
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5 pr-0.5">
                      {items.map((s) => (
                        <div
                          key={s.slot_id}
                          className={`text-[10px] px-1 lg:px-1.5 py-0.5 rounded leading-tight ${statusClasses(s.status)}`}
                          title={`${new Date(s.start_time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} – ${new Date(s.end_time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`}
                        >
                          {new Date(s.start_time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="shrink-0 mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {[
                ["Available", "bg-green-700/80 border-green-600"],
                ["Booked", "bg-yellow-700/80 border-yellow-600"],
                ["Blocked", "bg-red-800/80 border-red-700"],
                ["Completed", "bg-blue-800/80 border-blue-700"],
                ["Cancelled", "bg-neutral-700/80 border-neutral-600"],
              ].map(([label, cls]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className={`inline-block w-2.5 h-2.5 rounded border ${cls}`} />
                  <span className="text-neutral-400">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right sidebar: Add Availability + List */}
          <aside className={`min-h-0 flex flex-col bg-[#121212] rounded-lg border border-white/10 p-3 lg:p-4 ${
            mobileTab !== "availability" ? "hidden lg:flex" : "flex"
          }`}>
            <h2 className="shrink-0 text-base font-medium mb-3">My Availability</h2>

            <div className="shrink-0 space-y-2.5">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Date</label>
                <Input type="date" value={selDate} onChange={(e) => setSelDate(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Start Time</label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">End Time</label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Notes (Optional)</label>
                <Input
                  placeholder='e.g., "Consultations only"'
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <Button
                onClick={addSlot}
                disabled={saving}
                className="w-full h-8 text-sm bg-[#a32020] hover:bg-[#8a1b1b]"
              >
                + Add Availability
              </Button>
            </div>

            <div className="mt-4 flex flex-col min-h-0 flex-1">
              <h3 className="shrink-0 text-xs text-neutral-400 mb-2">Scheduled Availability</h3>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
                {slots.length === 0 && <p className="text-neutral-500 text-sm">No availability added yet.</p>}
                {slots
                  .slice()
                  .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time))
                  .map((s) => (
                    <div
                      key={s.slot_id}
                      className="border border-white/10 rounded-md px-3 py-2 flex items-center justify-between"
                    >
                      <div className="text-xs">
                        <div className="font-medium">
                          {new Date(s.start_time).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                        </div>
                        <div className="text-neutral-400">
                          {new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} —{" "}
                          {new Date(s.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        {s.status && <div className="text-[10px] mt-0.5 capitalize text-neutral-500">{s.status}</div>}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-7 h-7 text-neutral-400 hover:text-red-400 shrink-0"
                        onClick={() => deleteSlot(s.slot_id)}
                        title="Delete slot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
