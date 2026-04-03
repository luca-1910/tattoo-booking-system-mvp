/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Clock,
  CheckCircle,
  XCircle,
  Calendar as CalendarIcon,
  Settings,
  LogOut,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import { StatsCard } from "./StatsCard";
import { BookingCard } from "./BookingCard";
import { Button } from "./ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import { useRequireAdmin } from "@/hooks/useRequireAdmin"; // ✅ guard hook
import { supabaseBrowser } from "@/lib/supabaseBrowserClient";
import {
  type BookingRequestStatus,
  type SlotStatus,
  normalizeBookingRequestStatus,
  normalizeSlotStatus,
} from "@/lib/domain";

type FilterTab = "all" | BookingRequestStatus;

interface DashboardProps {
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

/**
 * This type matches what your BookingCard expects (based on your existing dashboard UI).
 * If your BookingCard expects slightly different names, keep the UI the same and adjust mapping below.
 */
type BookingUI = {
  id: any; // booking_request primary key (number/uuid). keep flexible.
  clientName: string;
  email: string;
  phone: string;
  tattooIdea: string;
  date: string; // display label
  time: string; // display label
  status: BookingRequestStatus;
  hasImages: boolean;
  imageCount?: number;
  paymentProofUrl?: string | null;
  referenceImageUrl?: string | null;

  // needed for approve -> book slot
  requestedSlotId: string | null;
};

type BookingRequestRow = {
  request_id: any;
  name: string | null;
  email: string | null;
  phone: string | null;
  tattoo_idea: string | null;
  status: BookingRequestStatus | string | null;
  reference_image_url: string | null;
  payment_proof_url: string | null;
  requested_slot_id: string | null;
  created_at?: string | null;
};

type SlotRow = {
  slot_id: string;
  start_time: string;
  end_time: string;
  status: SlotStatus | null;
};

function formatDateLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTimeLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const chartData = [
  { month: "Jan", hoursWorked: 120, hoursAvailable: 160 },
  { month: "Feb", hoursWorked: 145, hoursAvailable: 160 },
  { month: "Mar", hoursWorked: 130, hoursAvailable: 160 },
  { month: "Apr", hoursWorked: 155, hoursAvailable: 160 },
  { month: "May", hoursWorked: 140, hoursAvailable: 160 },
  { month: "Jun", hoursWorked: 150, hoursAvailable: 160 },
];

export default function Dashboard({ onNavigate, onLogout }: DashboardProps) {
  const checking = useRequireAdmin();
  const supabase = supabaseBrowser();

  const [bookings, setBookings] = useState<BookingUI[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  // ─────────────────────────────────────────────────────────
  // Fetch booking requests + their slot date/time
  // ─────────────────────────────────────────────────────────
  const fetchBookings = async () => {
    try {
      setLoadingBookings(true);

      const { data: reqs, error: reqErr } = await supabase
        .from("booking_request")
        .select(
          "request_id,name,email,phone,tattoo_idea,status,reference_image_url,payment_proof_url,requested_slot_id,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(200);

      if (reqErr) throw reqErr;

      const requests = (reqs ?? []) as BookingRequestRow[];

      const slotIds = Array.from(
        new Set(
          requests
            .map((r) => r.requested_slot_id)
            .filter((x): x is string => Boolean(x)),
        ),
      );

      const slotMap = new Map<string, SlotRow>();
      if (slotIds.length > 0) {
        const { data: slots, error: slotErr } = await supabase
          .from("slot")
          .select("slot_id,start_time,end_time,status")
          .in("slot_id", slotIds);

        if (slotErr) throw slotErr;

        (slots ?? []).forEach((s: any) => {
          slotMap.set(s.slot_id, {
            ...(s as SlotRow),
            status: normalizeSlotStatus(s.status),
          });
        });
      }

      const mapped: BookingUI[] = requests.map((r) => {
        const slot = r.requested_slot_id
          ? slotMap.get(r.requested_slot_id)
          : null;

        // Normalize status to what your filters expect
        const status = normalizeBookingRequestStatus(r.status);

        return {
          id: r.request_id,
          clientName: r.name ?? "Unknown",
          email: r.email ?? "",
          phone: r.phone ?? "",
          tattooIdea: r.tattoo_idea ?? "",
          date: slot?.start_time ? formatDateLabel(slot.start_time) : "TBD",
          time: slot?.start_time ? formatTimeLabel(slot.start_time) : "TBD",
          status,
          hasImages: Boolean(r.reference_image_url),
          imageCount: r.reference_image_url ? 1 : 0,
          requestedSlotId: r.requested_slot_id ?? null,
          paymentProofUrl: r.payment_proof_url ?? null,
          referenceImageUrl: r.reference_image_url ?? null,
        };
      });

      setBookings(mapped);
    } catch (e: any) {
      console.error("FETCH BOOKINGS ERROR:", e);
      toast.error(e?.message || "Failed to load booking requests.");
      setBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    if (checking) return;
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking]);

  // ─────────────────────────────────────────────────────────
  // Filters + stats (same UI behavior)
  // ─────────────────────────────────────────────────────────
  const filteredBookings = useMemo(() => {
    if (activeFilter === "all") return bookings;
    return bookings.filter((b) => b.status === activeFilter);
  }, [bookings, activeFilter]);

  const stats = useMemo(
    () => ({
      pending: bookings.filter((b) => b.status === "pending").length,
      approved: bookings.filter((b) => b.status === "approved").length,
      rejected: bookings.filter((b) => b.status === "rejected").length,
      completed: bookings.filter((b) => b.status === "completed").length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length,
      expired: bookings.filter((b) => b.status === "expired").length,
    }),
    [bookings],
  );

  // ─────────────────────────────────────────────────────────
  // Approve / Reject
  // ─────────────────────────────────────────────────────────
  const handleApprove = async (id: any) => {
    const booking = bookings.find((b) => b.id === id);
    if (!booking) return;

    if (!booking.requestedSlotId) {
      toast.error("This request has no selected slot.");
      return;
    }

    try {
      // 1) Mark booking_request approved
      const { error: reqErr } = await supabase
        .from("booking_request")
        .update({ status: "approved" })
        .eq("request_id", id);

      if (reqErr) throw reqErr;

      // 2) Book the slot with a guard to prevent double booking.
      // Try lowercase first (your current recommended model).
      let updated = false;

      const tryUpdate = async (availableValue: string, bookedValue: string) => {
        const { data, error } = await supabase
          .from("slot")
          .update({ status: bookedValue })
          .eq("slot_id", booking.requestedSlotId!)
          .eq("status", availableValue)
          .select("slot_id");

        if (error) throw error;
        if (data && data.length > 0) updated = true;
      };

      // Attempt both casing conventions (handles legacy rows safely)
      await tryUpdate("available", "booked");
      if (!updated) {
        await tryUpdate("Available", "Booked");
      }

      if (!updated) {
        toast.error("Slot was already booked (or not available).");
        // Optionally revert booking_request to pending to keep consistency:
        // await supabase.from("booking_request").update({ status: "pending" }).eq("id", id);
        return;
      }

      toast.success("Booking approved and slot booked.");

      // Update local state to reflect approval without a full refetch
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: "approved" } : b)),
      );
    } catch (e: any) {
      console.error("APPROVE ERROR:", e);
      toast.error(e?.message || "Failed to approve booking.");
    }
  };

  const handleReject = async (id: any) => {
    try {
      const { error } = await supabase
        .from("booking_request")
        .update({ status: "rejected" })
        .eq("request_id", id);

      if (error) throw error;

      toast.error("Booking rejected");

      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: "rejected" } : b)),
      );
    } catch (e: any) {
      console.error("REJECT ERROR:", e);
      toast.error(e?.message || "Failed to reject booking.");
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Failed to log out. Please try again.");
      return;
    }

    onLogout?.();
    toast.success("Logged out successfully");
    onNavigate("home");
  };

  // ✅ guard AFTER hooks
  if (checking) return null;

  const filterTabs = [
    { id: "all", label: "All Bookings", count: bookings.length },
    { id: "pending", label: "Pending", count: stats.pending },
    { id: "approved", label: "Confirmed", count: stats.approved },
    { id: "completed", label: "Completed", count: stats.completed },
    { id: "rejected", label: "Rejected", count: stats.rejected },
    { id: "cancelled", label: "Cancelled", count: stats.cancelled },
    { id: "expired", label: "Expired", count: stats.expired },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5]">
      {/* Top Navigation */}
      <div className="border-b border-[rgba(255,255,255,0.1)] bg-[#1a1a1a] sticky top-0 z-50 shadow-lg shadow-black/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="hidden sm:block">MissMay Dashboard</h1>
          <h1 className="sm:hidden">Dashboard</h1>

          <div className="flex gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onNavigate("calendar")}
              className="text-[#e5e5e5] hover:text-[#a32020] hover:bg-[#a32020]/10 sm:w-auto sm:px-4"
            >
              <CalendarIcon className="w-5 h-5" />
              <span className="hidden sm:inline ml-2">Calendar</span>
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

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <StatsCard
            title="Pending"
            value={stats.pending}
            icon={<Clock />}
            color="#f59e0b"
          />
          <StatsCard
            title="Approved"
            value={stats.approved}
            icon={<CheckCircle />}
            color="#10b981"
          />
          <StatsCard
            title="Rejected"
            value={stats.rejected}
            icon={<XCircle />}
            color="#ef4444"
          />
          <StatsCard
            title="Completed"
            value={stats.completed}
            icon={<CheckCircle />}
            color="#3b82f6"
          />
        </div>

        {/* Chart (unchanged) */}
        <div className="bg-[#1a1a1a] rounded-lg p-4 sm:p-6 border border-[rgba(255,255,255,0.1)] mb-6 sm:mb-8 shadow-xl shadow-black/10">
          <div className="flex items-center gap-2 mb-4 sm:mb-6">
            <BarChart3 className="w-5 h-5 text-[#a32020]" />
            <h2>Hours Worked vs Available</h2>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis dataKey="month" stroke="#a0a0a0" />
              <YAxis stroke="#a0a0a0" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1a1a",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  color: "#e5e5e5",
                }}
              />
              <Bar dataKey="hoursWorked" fill="#a32020" radius={[4, 4, 0, 0]} />
              <Bar
                dataKey="hoursAvailable"
                fill="#2a2a2a"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Booking List */}
        <div>
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2>Booking Requests</h2>

            <Button
              variant="ghost"
              onClick={fetchBookings}
              className="text-[#e5e5e5] hover:text-[#a32020] hover:bg-[#a32020]/10"
            >
              {loadingBookings ? "Refreshing…" : "Refresh"}
            </Button>
          </div>

          <div className="bg-[#1a1a1a] rounded-lg p-2 sm:p-4 border border-[rgba(255,255,255,0.1)] mb-6 shadow-xl shadow-black/10">
            <div className="flex overflow-x-auto gap-1 sm:gap-2 scrollbar-hide">
              {filterTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id as FilterTab)}
                  className={`relative px-3 sm:px-4 py-2 sm:py-3 rounded-md whitespace-nowrap transition-all duration-300 ${
                    activeFilter === tab.id
                      ? "text-[#a32020]"
                      : "text-[#a0a0a0] hover:text-[#e5e5e5] hover:bg-[#0a0a0a]"
                  }`}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {tab.label}
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        activeFilter === tab.id
                          ? "bg-[#a32020]/20 text-[#a32020]"
                          : "bg-[#2a2a2a] text-[#a0a0a0]"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </span>
                  {activeFilter === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#a32020] rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {loadingBookings ? (
              <div className="col-span-full bg-[#1a1a1a] rounded-lg p-12 border border-[rgba(255,255,255,0.1)] text-center">
                <p className="text-[#a0a0a0]">Loading booking requests…</p>
              </div>
            ) : filteredBookings.length > 0 ? (
              filteredBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))
            ) : (
              <div className="col-span-full bg-[#1a1a1a] rounded-lg p-12 border border-[rgba(255,255,255,0.1)] text-center">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-[#a0a0a0]" />
                <h3 className="mb-2 text-[#e5e5e5]">No bookings found</h3>
                <p className="text-[#a0a0a0]">
                  There are no {activeFilter !== "all" && activeFilter} bookings
                  at the moment.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
