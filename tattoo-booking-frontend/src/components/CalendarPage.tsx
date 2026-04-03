/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowserClient";
import { useRequireAdmin } from "@/hooks/useRequireAdmin";
import { type SlotStatus, normalizeSlotStatus } from "@/lib/domain";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

type Slot = {
  slot_id: string;
  artist_id: string;
  start_time: string; // timestamptz
  end_time: string;   // timestamptz
  status: SlotStatus | null;
  created_at?: string;
  updated_at?: string;
};

type ViewMode = "month" | "week";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// util: floor to 00:00 local
function startOfDayLocal(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// util: get days of a calendar month view
function getMonthMatrix(year: number, monthIndex0: number) {
  // monthIndex0: 0 = Jan
  const first = new Date(year, monthIndex0, 1);
  const firstDow = first.getDay(); // 0..6

  const weeks: Date[][] = [];
  const cur = new Date(year, monthIndex0, 1 - firstDow); // start from the Sunday of the first week

  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

// build a local ISO (treat inputs as local and send ISO)
// supabase/postgres timestamptz will interpret ISO 8601 as UTC
function toIsoLocal(date: string, time: string) {
  // date = "YYYY-MM-DD", time = "HH:MM"
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
  return dt.toISOString();
}

export default function CalendarPage() {
  const checking = useRequireAdmin();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const didInitialLoad = useRef(false);

  const [artistId, setArtistId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [saving, setSaving] = useState(false);

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

  // fetch artist id and initial slots
  useEffect(() => {
    if (checking || didInitialLoad.current) return;
    didInitialLoad.current = true;

    (async () => {
      // You enabled this schema; use explicit schema selector for clarity.
      const { data: artistRow, error: artistErr } = await supabase
        .from("tattoo_artist")
        .select("artist_id")
        .limit(1)
        .maybeSingle();

      if (artistErr) {
        toast.error(artistErr.message);
        return;
      }
      if (!artistRow?.artist_id) {
        toast.error("No artist found in tattoo_artist");
        return;
      }

      setArtistId(artistRow.artist_id);

      // initial fetch
      const { data: rows, error } = await supabase
        .from("slot")
        .select("*")
        .eq("artist_id", artistRow.artist_id)
        .order("start_time", { ascending: true });

      if (error) toast.error(error.message);
      else {
        setSlots(
          ((rows as Slot[]) ?? []).map((slot) => ({
            ...slot,
            status: normalizeSlotStatus(slot.status),
          })),
        );
      }
    })();
  }, [checking, supabase]);

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
    if (!artistId) {
      toast.error("Artist not loaded yet.");
      return;
    }
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
        artist_id: artistId,
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

  if (checking) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5] p-6">
      {/* Header */}
      <div className="flex items-center justify-between max-w-6xl mx-auto mb-4">
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

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Calendar panel */}
        <div className="bg-[#121212] rounded-lg border border-white/10 p-4">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <div className="font-medium">{currentMonth}</div>
            <div className="flex gap-2">
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
          <div className="grid grid-cols-7 text-center text-sm text-neutral-400 mb-2">
            {DAY_LABELS.map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-7 gap-2">
            {monthMatrix.flat().map((day, idx) => {
              const isThisMonth = day.getMonth() === cursor.getMonth();
              const key = startOfDayLocal(day).toDateString();
              const items = slotsByDay.get(key) || [];
              return (
                <div
                  key={`${key}-${idx}`}
                  className={`rounded-lg p-2 h-28 border ${
                    isThisMonth ? "border-white/10" : "border-white/5 opacity-60"
                  } bg-black/30`}
                >
                  <div className="text-xs text-neutral-400 mb-1">{day.getDate()}</div>
                  <div className="space-y-1 overflow-y-auto max-h-20 pr-1">
                    {items.map((s) => (
                      <div
                        key={s.slot_id}
                        className={`text-[11px] px-2 py-1 rounded ${statusClasses(s.status)}`}
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
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {[
              ["Available", "bg-green-700/80 border-green-600"],
              ["Booked", "bg-yellow-700/80 border-yellow-600"],
              ["Blocked", "bg-red-800/80 border-red-700"],
              ["Completed", "bg-blue-800/80 border-blue-700"],
              ["Cancelled", "bg-neutral-700/80 border-neutral-600"],
            ].map(([label, cls]) => (
              <div key={label} className="flex items-center gap-2">
                <span className={`inline-block w-3 h-3 rounded ${cls}`} />
                <span className="text-neutral-300">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right sidebar: Add Availability + List */}
        <aside className="bg-[#121212] rounded-lg border border-white/10 p-4">
          <h2 className="text-lg mb-4">My Availability</h2>

          <div className="space-y-3">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Date</label>
              <Input type="date" value={selDate} onChange={(e) => setSelDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Start Time</label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">End Time</label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Notes (Optional)</label>
              <Input
                placeholder='e.g., "Available for consultations only"'
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <Button
              onClick={addSlot}
              disabled={saving || !artistId}
              className="w-full bg-[#a32020] hover:bg-[#8a1b1b]"
            >
              + Add
            </Button>
          </div>

          <div className="mt-6">
            <h3 className="text-sm text-neutral-400 mb-2">Scheduled Availability</h3>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {slots.length === 0 && <p className="text-neutral-500 text-sm">No availability added yet.</p>}
              {slots
                .slice()
                .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time))
                .map((s) => (
                  <div
                    key={s.slot_id}
                    className="border border-white/10 rounded-md p-3 flex items-center justify-between"
                  >
                    <div className="text-sm">
                      <div className="font-medium">
                        {new Date(s.start_time).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                      </div>
                      <div className="text-neutral-400">
                        {new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} —{" "}
                        {new Date(s.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      {s.status && <div className="text-xs mt-1 capitalize">{s.status}</div>}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-neutral-400 hover:text-red-400"
                      onClick={() => deleteSlot(s.slot_id)}
                      title="Delete slot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
