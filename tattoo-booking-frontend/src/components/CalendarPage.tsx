/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowserClient";
import { useRequireArtistProfile } from "@/hooks/useRequireAdmin";
import { type SlotStatus, normalizeSlotStatus } from "@/lib/domain";
import { startOfDayLocal, getMonthMatrix, toIsoLocal } from "@/lib/calendarUtils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, RefreshCw, Trash2, Settings, LogOut, LayoutDashboard, AlertTriangle, Ban, Pencil, Check, X, User as UserIcon, Mail, Phone, Clock as ClockIcon } from "lucide-react";

type Slot = {
  slot_id: string;
  start_time: string; // timestamptz
  end_time: string;   // timestamptz
  status: SlotStatus | null;
  created_at?: string;
  updated_at?: string;
};

type BookingDetail = {
  request_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  tattoo_idea: string | null;
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
  const [syncingAll, setSyncingAll] = useState(false);
  // slot_id -> error message for approved bookings whose calendar sync failed
  const [failedSyncs, setFailedSyncs] = useState<Map<string, string>>(new Map());
  // slot_id -> request_id for approved bookings (used for cancel)
  const [bookingBySlot, setBookingBySlot] = useState<Map<string, string>>(new Map());
  // slot_id -> rich booking details (used for hover popovers)
  const [bookingDetailsBySlot, setBookingDetailsBySlot] = useState<Map<string, BookingDetail>>(new Map());
  // inline edit state
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editSaving, setEditSaving] = useState(false);

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

  const fetchSlots = async () => {
    try {
      const [slotsRes, failedRes, bookingRes] = await Promise.all([
        supabase.from("slot").select("*").order("start_time", { ascending: true }),
        supabase
          .from("booking_request")
          .select("requested_slot_id,google_calendar_sync_error")
          .eq("status", "approved")
          .eq("google_calendar_sync_status", "failed")
          .not("requested_slot_id", "is", null),
        supabase
          .from("booking_request")
          .select("request_id,requested_slot_id,name,email,phone,tattoo_idea")
          .eq("status", "approved")
          .not("requested_slot_id", "is", null),
      ]);

      if (slotsRes.error) toast.error(slotsRes.error.message);
      else {
        setSlots(
          ((slotsRes.data as Slot[]) ?? []).map((slot) => ({
            ...slot,
            status: normalizeSlotStatus(slot.status),
          })),
        );
      }

      if (!failedRes.error && failedRes.data) {
        const map = new Map<string, string>();
        for (const row of failedRes.data as { requested_slot_id: string; google_calendar_sync_error: string | null }[]) {
          map.set(row.requested_slot_id, row.google_calendar_sync_error ?? "Calendar sync failed.");
        }
        setFailedSyncs(map);
      }

      if (!bookingRes.error && bookingRes.data) {
        const idMap = new Map<string, string>();
        const detailMap = new Map<string, BookingDetail>();
        for (const row of bookingRes.data as (BookingDetail & { requested_slot_id: string })[]) {
          idMap.set(row.requested_slot_id, row.request_id);
          detailMap.set(row.requested_slot_id, {
            request_id: row.request_id,
            name: row.name,
            email: row.email,
            phone: row.phone,
            tattoo_idea: row.tattoo_idea,
          });
        }
        setBookingBySlot(idMap);
        setBookingDetailsBySlot(detailMap);
      }

    } catch (e: any) {
      toast.error(e?.message || "Failed to load calendar.");
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

  const weekDays = useMemo(() => {
    const start = new Date(cursor);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay()); // back up to Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

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
  const weekRangeLabel = useMemo(() => {
    const first = weekDays[0];
    const last = weekDays[6];
    const sameMonth = first.getMonth() === last.getMonth();
    const sameYear = first.getFullYear() === last.getFullYear();
    const firstStr = first.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const lastStr = last.toLocaleDateString(undefined, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" });
    return `${firstStr} – ${lastStr}, ${sameYear ? last.getFullYear() : `${first.getFullYear()}/${last.getFullYear()}`}`;
  }, [weekDays]);

  function navigatePrev() {
    if (view === "month") {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
    } else {
      const d = new Date(cursor);
      d.setDate(d.getDate() - 7);
      setCursor(d);
    }
  }
  function navigateNext() {
    if (view === "month") {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
    } else {
      const d = new Date(cursor);
      d.setDate(d.getDate() + 7);
      setCursor(d);
    }
  }

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
      const res = await fetch(`/api/admin/slots/${slotId}`, { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to delete slot.");
      setSlots((prev) => prev.filter((s) => s.slot_id !== slotId));
      setFailedSyncs((prev) => { const m = new Map(prev); m.delete(slotId); return m; });
      toast.success("Availability deleted.");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete slot.");
    }
  }

  const [deletingOutdated, setDeletingOutdated] = useState(false);

  async function deleteOutdated() {
    const now = new Date();
    const past = slots.filter((s) => s.status === "available" && new Date(s.end_time) < now);
    if (past.length === 0) { toast.info("No outdated slots to delete."); return; }
    setDeletingOutdated(true);
    let failed = 0;
    const deleted: string[] = [];
    await Promise.all(
      past.map(async (s) => {
        try {
          const res = await fetch(`/api/admin/slots/${s.slot_id}`, { method: "DELETE" });
          if (!res.ok) { failed++; return; }
          deleted.push(s.slot_id);
        } catch {
          failed++;
        }
      }),
    );
    setSlots((prev) => prev.filter((s) => !deleted.includes(s.slot_id)));
    setFailedSyncs((prev) => {
      const m = new Map(prev);
      deleted.forEach((id) => m.delete(id));
      return m;
    });
    setDeletingOutdated(false);
    if (failed === 0) toast.success(`Deleted ${deleted.length} outdated slot${deleted.length !== 1 ? "s" : ""}.`);
    else toast.warning(`Deleted ${deleted.length}, failed to delete ${failed}.`);
  }

  // status -> chip styles (matches your legend colors)
  function statusClasses(status?: string | null) {
    switch (status) {
      case "available":
        return "bg-emerald-500/15 text-emerald-300 border-l-2 border-emerald-400 hover:bg-emerald-500/25";
      case "booked":
        return "bg-amber-500/15 text-amber-300 border-l-2 border-amber-400 hover:bg-amber-500/25";
      case "blocked":
        return "bg-rose-500/15 text-rose-300 border-l-2 border-rose-400 hover:bg-rose-500/25";
      case "completed":
        return "bg-sky-500/15 text-sky-300 border-l-2 border-sky-400 hover:bg-sky-500/25";
      case "cancelled":
        return "bg-neutral-500/15 text-neutral-300 border-l-2 border-neutral-400 hover:bg-neutral-500/25";
      default:
        return "bg-neutral-500/15 text-neutral-300 border-l-2 border-neutral-400 hover:bg-neutral-500/25";
    }
  }

  function statusDotClasses(status?: string | null) {
    switch (status) {
      case "available": return "bg-emerald-400";
      case "booked":    return "bg-amber-400";
      case "blocked":   return "bg-rose-400";
      case "completed": return "bg-sky-400";
      case "cancelled": return "bg-neutral-400";
      default:          return "bg-neutral-400";
    }
  }

  async function cancelBooking(slotId: string) {
    const requestId = bookingBySlot.get(slotId);
    if (!requestId) { toast.error("No booking found for this slot."); return; }
    try {
      const res = await fetch(`/api/admin/bookings/${requestId}/cancel`, { method: "POST" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to cancel booking.");
      // Update slot status locally to available
      setSlots((prev) => prev.map((s) => s.slot_id === slotId ? { ...s, status: "available" } : s));
      setBookingBySlot((prev) => { const m = new Map(prev); m.delete(slotId); return m; });
      setFailedSyncs((prev) => { const m = new Map(prev); m.delete(slotId); return m; });
      toast.warning("Booking cancelled.");
    } catch (e: any) {
      toast.error(e.message || "Failed to cancel booking.");
    }
  }

  function startEdit(s: Slot) {
    const d = new Date(s.start_time);
    const pad = (n: number) => String(n).padStart(2, "0");
    setEditDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    setEditStartTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    const de = new Date(s.end_time);
    setEditEndTime(`${pad(de.getHours())}:${pad(de.getMinutes())}`);
    setEditingSlotId(s.slot_id);
  }

  async function saveEdit(slotId: string) {
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/slots/${slotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: editDate, startTime: editStartTime, endTime: editEndTime }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to reschedule.");
      setSlots((prev) => prev.map((s) =>
        s.slot_id === slotId ? { ...s, start_time: payload.startTime, end_time: payload.endTime } : s
      ));
      setEditingSlotId(null);
      toast.success("Slot rescheduled.");
    } catch (e: any) {
      toast.error(e.message || "Failed to reschedule slot.");
    } finally {
      setEditSaving(false);
    }
  }

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await fetch("/api/admin/bookings/sync-calendar", { method: "POST" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Sync failed.");

      const { synced, skipped, failed, gcalDeleted } = payload as {
        synced: number; skipped: number; failed: number; gcalDeleted: number;
      };

      if (gcalDeleted > 0) {
        toast.warning(`${gcalDeleted} appointment${gcalDeleted !== 1 ? "s" : ""} cancelled — deleted from Google Calendar.`);
      }

      if (synced === 0 && failed === 0) {
        if (gcalDeleted === 0) toast.info("All bookings are already synced.");
      } else if (failed === 0) {
        toast.success(`Synced ${synced} booking${synced !== 1 ? "s" : ""} to Google Calendar.`);
      } else {
        toast.warning(`Synced ${synced}, failed ${failed}. Check calendar settings.`);
      }

      // Refresh so sync flags update
      await fetchSlots();
    } catch (e: any) {
      toast.error(e?.message || "Calendar sync failed.");
    } finally {
      setSyncingAll(false);
    }
  };

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
        {/* Main panels — side by side on desktop, tab-switched on mobile */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">

          {/* Calendar panel */}
          <div className={`min-h-0 flex flex-col bg-[#121212] rounded-lg border border-white/10 p-3 lg:p-4 ${
            mobileTab !== "calendar" ? "hidden lg:flex" : "flex"
          }`}>
            {/* Month nav */}
            <div className="shrink-0 flex items-center justify-between mb-2 gap-2 flex-wrap">
              <div className="font-medium">{view === "month" ? currentMonth : weekRangeLabel}</div>
              <div className="flex items-center gap-2">
                <div className="hidden lg:inline-flex rounded-md border border-white/10 bg-[#0f0f0f] p-0.5">
                  <button
                    onClick={() => setView("week")}
                    className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors ${
                      view === "week" ? "bg-[#a32020] text-white" : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    Week
                  </button>
                  <button
                    onClick={() => setView("month")}
                    className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors ${
                      view === "month" ? "bg-[#a32020] text-white" : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    Month
                  </button>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSyncAll}
                    disabled={syncingAll}
                    title="Sync approved bookings to Google Calendar"
                    className="h-8 px-2 text-xs text-neutral-400 hover:text-[#e5e5e5]"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5${syncingAll ? " animate-spin" : ""}`} />
                    {syncingAll ? "Syncing…" : "Sync"}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={navigatePrev}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={navigateNext}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Day labels */}
            <div className="shrink-0 grid grid-cols-7 text-center text-[11px] uppercase tracking-wider text-neutral-500 mb-1.5">
              {DAY_LABELS.map((d) => (
                <div key={d} className="py-1.5 font-medium">{d}</div>
              ))}
            </div>

            {/* Day cells grid — month (6×7) or week (1×7) */}
            <div className={`flex-1 min-h-0 grid grid-cols-7 gap-1.5 ${view === "month" ? "grid-rows-6" : "grid-rows-1"}`}>
              {(view === "month" ? monthMatrix.flat() : weekDays).map((day, idx) => {
                const isThisMonth = view === "week" ? true : day.getMonth() === cursor.getMonth();
                const key = startOfDayLocal(day).toDateString();
                const items = slotsByDay.get(key) || [];
                const hasSyncError = items.some((s) => failedSyncs.has(s.slot_id));
                const isToday = startOfDayLocal(day).getTime() === startOfDayLocal(new Date()).getTime();
                return (
                  <div
                    key={`${key}-${idx}`}
                    className={`group rounded-lg p-1.5 lg:p-2 min-h-0 overflow-hidden border transition-colors ${
                      hasSyncError
                        ? "border-orange-500/40 bg-orange-950/10"
                        : isToday
                        ? "border-[#a32020]/60 bg-[#a32020]/5"
                        : isThisMonth
                        ? "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]"
                        : "border-white/[0.04] bg-black/20 opacity-40"
                    } flex flex-col`}
                  >
                    <div className="text-[11px] leading-none mb-1.5 shrink-0 flex items-center justify-between">
                      <span className={`font-medium ${isToday ? "text-[#a32020]" : isThisMonth ? "text-neutral-300" : "text-neutral-500"}`}>
                        {view === "week" ? day.toLocaleDateString(undefined, { weekday: "short", day: "numeric" }) : day.getDate()}
                      </span>
                      {hasSyncError && (
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400" title="Calendar sync failed" />
                      )}
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5">
                      {items.map((s) => {
                        const detail = bookingDetailsBySlot.get(s.slot_id);
                        const syncErr = failedSyncs.get(s.slot_id);
                        const startLabel = new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                        const endLabel = new Date(s.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                        return (
                          <HoverCard key={s.slot_id} openDelay={120} closeDelay={80}>
                            <HoverCardTrigger asChild>
                              <div
                                className={`text-[10px] px-1.5 py-1 rounded-sm leading-tight cursor-pointer transition-colors font-medium ${statusClasses(s.status)}`}
                              >
                                {startLabel}
                              </div>
                            </HoverCardTrigger>
                            <HoverCardContent
                              side="top"
                              align="start"
                              className="w-72 bg-[#0f0f0f] border border-white/10 text-[#e5e5e5] p-0 overflow-hidden shadow-2xl shadow-black/50"
                            >
                              {/* Header */}
                              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10 bg-white/[0.02]">
                                <span className={`w-2 h-2 rounded-full ${statusDotClasses(s.status)}`} />
                                <span className="text-xs font-medium capitalize">{s.status ?? "unknown"}</span>
                                {syncErr && (
                                  <span className="ml-auto flex items-center gap-1 text-[10px] text-orange-400">
                                    <AlertTriangle className="w-3 h-3" /> sync failed
                                  </span>
                                )}
                              </div>

                              {/* Time */}
                              <div className="px-3 py-2.5 border-b border-white/10 flex items-center gap-2 text-sm">
                                <ClockIcon className="w-3.5 h-3.5 text-neutral-400" />
                                <span className="text-neutral-200">{startLabel} — {endLabel}</span>
                                <span className="text-neutral-500 text-xs ml-auto">
                                  {new Date(s.start_time).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                                </span>
                              </div>

                              {/* Booking details if booked */}
                              {detail ? (
                                <div className="px-3 py-2.5 space-y-1.5">
                                  <div className="flex items-center gap-2 text-sm">
                                    <UserIcon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                    <span className="text-neutral-100 font-medium truncate">{detail.name ?? "Unknown"}</span>
                                  </div>
                                  {detail.email && (
                                    <div className="flex items-center gap-2 text-xs">
                                      <Mail className="w-3 h-3 text-neutral-500 shrink-0" />
                                      <span className="text-neutral-400 truncate">{detail.email}</span>
                                    </div>
                                  )}
                                  {detail.phone && (
                                    <div className="flex items-center gap-2 text-xs">
                                      <Phone className="w-3 h-3 text-neutral-500 shrink-0" />
                                      <span className="text-neutral-400">{detail.phone}</span>
                                    </div>
                                  )}
                                  {detail.tattoo_idea && (
                                    <div className="pt-1.5 mt-1.5 border-t border-white/5">
                                      <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">Tattoo idea</p>
                                      <p className="text-xs text-neutral-300 line-clamp-3">{detail.tattoo_idea}</p>
                                    </div>
                                  )}
                                  {syncErr && (
                                    <div className="pt-1.5 mt-1.5 border-t border-white/5">
                                      <p className="text-[10px] text-orange-400 leading-snug">{syncErr}</p>
                                    </div>
                                  )}
                                </div>
                              ) : s.status === "available" ? (
                                <div className="px-3 py-2.5 text-xs text-neutral-500">
                                  Open for booking
                                </div>
                              ) : (
                                <div className="px-3 py-2.5 text-xs text-neutral-500 capitalize">
                                  {s.status ?? "No details"}
                                </div>
                              )}
                            </HoverCardContent>
                          </HoverCard>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="shrink-0 mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
              {[
                ["Available", "bg-emerald-400"],
                ["Booked", "bg-amber-400"],
                ["Blocked", "bg-rose-400"],
                ["Completed", "bg-sky-400"],
                ["Cancelled", "bg-neutral-400"],
              ].map(([label, cls]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />
                  <span className="text-neutral-500">{label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-orange-400 ring-1 ring-orange-400/30" />
                <span className="text-neutral-500">Sync failed</span>
              </div>
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
              <div className="shrink-0 flex items-center justify-between mb-2">
                <h3 className="text-xs text-neutral-400">Scheduled Availability</h3>
                {(() => {
                  const outdatedCount = slots.filter((s) => s.status === "available" && new Date(s.end_time) < new Date()).length;
                  return outdatedCount > 0 ? (
                    <button
                      onClick={deleteOutdated}
                      disabled={deletingOutdated}
                      className="text-[10px] text-neutral-500 hover:text-red-400 disabled:opacity-50 transition-colors"
                      title={`Delete ${outdatedCount} past slot${outdatedCount !== 1 ? "s" : ""}`}
                    >
                      {deletingOutdated ? "Deleting…" : `Delete outdated (${outdatedCount})`}
                    </button>
                  ) : null;
                })()}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
                {(() => {
                  const availableSlots = slots.filter((s) => s.status === "available");
                  if (availableSlots.length === 0) {
                    return <p className="text-neutral-500 text-sm">No availability added yet.</p>;
                  }
                  return null;
                })()}
                {slots
                  .filter((s) => s.status === "available")
                  .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time))
                  .map((s) => {
                    const syncError = failedSyncs.get(s.slot_id);
                    const isBooked = s.status === "booked";
                    const isEditing = editingSlotId === s.slot_id;
                    return (
                      <div
                        key={s.slot_id}
                        className={`border rounded-md px-3 py-2 flex flex-col gap-2 ${
                          syncError ? "border-orange-500/50 bg-orange-950/20" : "border-white/10"
                        }`}
                      >
                        {/* Slot info row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs min-w-0">
                            <div className="font-medium">
                              {new Date(s.start_time).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                            </div>
                            <div className="text-neutral-400">
                              {new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} —{" "}
                              {new Date(s.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                            {s.status && <div className="text-[10px] mt-0.5 capitalize text-neutral-500">{s.status}</div>}
                            {syncError && (
                              <div className="flex items-start gap-1 mt-1">
                                <AlertTriangle className="w-3 h-3 text-orange-400 shrink-0 mt-px" />
                                <span className="text-[10px] text-orange-400 leading-tight break-all">{syncError}</span>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          {isBooked ? (
                            <div className="flex gap-1 shrink-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="w-7 h-7 text-neutral-400 hover:text-blue-400"
                                onClick={() => isEditing ? setEditingSlotId(null) : startEdit(s)}
                                title={isEditing ? "Cancel edit" : "Reschedule"}
                              >
                                {isEditing ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="w-7 h-7 text-neutral-400 hover:text-orange-400"
                                onClick={() => cancelBooking(s.slot_id)}
                                title="Cancel booking"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="w-7 h-7 text-neutral-400 hover:text-red-400 shrink-0"
                              onClick={() => deleteSlot(s.slot_id)}
                              title="Delete slot"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>

                        {/* Inline edit form */}
                        {isEditing && (
                          <div className="space-y-1.5 pt-1 border-t border-white/10">
                            <Input
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="h-7 text-xs"
                            />
                            <div className="grid grid-cols-2 gap-1.5">
                              <Input
                                type="time"
                                value={editStartTime}
                                onChange={(e) => setEditStartTime(e.target.value)}
                                className="h-7 text-xs"
                              />
                              <Input
                                type="time"
                                value={editEndTime}
                                onChange={(e) => setEditEndTime(e.target.value)}
                                className="h-7 text-xs"
                              />
                            </div>
                            <Button
                              size="sm"
                              disabled={editSaving}
                              onClick={() => saveEdit(s.slot_id)}
                              className="w-full h-7 text-xs bg-[#a32020] hover:bg-[#8a1b1b]"
                            >
                              <Check className="w-3 h-3 mr-1" />
                              {editSaving ? "Saving…" : "Save"}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
