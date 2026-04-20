/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Clock,
  CheckCircle,
  XCircle,
  Ban,
  Calendar as CalendarIcon,
  Settings,
  LogOut,
  AlertCircle,
  LayoutGrid,
  LayoutList,
} from "lucide-react";
import { StatsCard } from "./StatsCard";
import { BookingCard } from "./BookingCard";
import { Button } from "./ui/button";
import { TutorialModal } from "./TutorialModal";
import { toast } from "sonner";
import { useRequireArtistProfile } from "@/hooks/useRequireAdmin"; // ✅ guard hook
import { supabaseBrowser } from "@/lib/supabaseBrowserClient";
import {
  type BookingRequestStatus,
  type SlotStatus,
  normalizeBookingRequestStatus,
  normalizeSlotStatus,
} from "@/lib/domain";

type FilterTab = BookingRequestStatus;

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

  // raw ISO start_time of the requested slot (for expiration logic)
  slotStartTime: string | null;
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

export default function Dashboard({ onNavigate, onLogout }: DashboardProps) {
  const checking = useRequireArtistProfile();
  const supabase = supabaseBrowser();

  const [bookings, setBookings] = useState<BookingUI[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  const [activeFilter, setActiveFilter] = useState<FilterTab>("pending");
  const [viewMode, setViewMode] = useState<"grid" | "card">("grid");
  const [showTutorial, setShowTutorial] = useState(false);

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
          slotStartTime: slot?.start_time ?? null,
        };
      });

      // Auto-expire approved bookings whose appointment day has passed.
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const toExpireIds = mapped
        .filter((b) => b.status === "approved" && b.slotStartTime && new Date(b.slotStartTime) < startOfToday)
        .map((b) => b.id);

      if (toExpireIds.length > 0) {
        const { error: expireError } = await supabase
          .from("booking_request")
          .update({ status: "expired" })
          .in("request_id", toExpireIds);

        if (!expireError) {
          for (const b of mapped) {
            if (toExpireIds.includes(b.id)) b.status = "expired";
          }
        }
      }

      setBookings(mapped);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load booking requests.");
      setBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    if (checking) return;
    fetchBookings();
    if (localStorage.getItem("pending_tutorial") === "1") {
      localStorage.removeItem("pending_tutorial");
      setShowTutorial(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking]);

  // ─────────────────────────────────────────────────────────
  // Filters + stats (same UI behavior)
  // ─────────────────────────────────────────────────────────
  const filteredBookings = useMemo(() => {
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
      const res = await fetch(`/api/admin/bookings/${id}/approve`, {
        method: "POST",
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to approve booking.");
      }

      if (payload.calendarSyncStatus === "synced") {
        toast.success("Booking approved, slot booked, and synced to Google Calendar.");
      } else if (payload.calendarSyncStatus === "skipped") {
        const reason = payload.calendarSyncError ? ` Reason: ${payload.calendarSyncError}` : "";
        toast.warning(`Booking approved and slot booked. Calendar sync skipped.${reason}`);
      } else {
        const reason = payload.calendarSyncError ? ` Error: ${payload.calendarSyncError}` : "";
        toast.error(`Booking approved and slot booked, but calendar sync failed.${reason}`);
      }

      // Update local state to reflect approval without a full refetch
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: "approved" } : b)),
      );
    } catch (e: any) {
      toast.error(e?.message || "Failed to approve booking.");
    }
  };

  const handleCancel = async (id: any) => {
    try {
      const res = await fetch(`/api/admin/bookings/${id}/cancel`, { method: "POST" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to cancel booking.");
      toast.warning("Booking cancelled.");
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)));
    } catch (e: any) {
      toast.error(e?.message || "Failed to cancel booking.");
    }
  };

  const handleDelete = async (id: any) => {
    try {
      const res = await fetch(`/api/admin/bookings/${id}/delete`, { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to delete booking.");
      setBookings((prev) => prev.filter((b) => b.id !== id));
      toast.success("Booking deleted.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete booking.");
    }
  };

  const handleReject = async (id: any) => {
    try {
      const res = await fetch(`/api/admin/bookings/${id}/reject`, {
        method: "POST",
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to reject booking.");
      }

      toast.error("Booking rejected");

      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: "rejected" } : b)),
      );
    } catch (e: any) {
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
    { id: "pending", label: "Pending", count: stats.pending },
    { id: "approved", label: "Approved", count: stats.approved },
    { id: "rejected", label: "Rejected", count: stats.rejected },
    { id: "cancelled", label: "Cancelled", count: stats.cancelled },
    { id: "expired", label: "Expired", count: stats.expired },
  ];

  return (
    <>
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
            title="Cancelled"
            value={stats.cancelled}
            icon={<Ban />}
            color="#6b7280"
          />
        </div>

        {/* Upcoming Appointments */}
        {(() => {
          const upcoming = bookings
            .filter((b) => b.status === "approved" && b.date !== "TBD")
            .slice(0, 4);
          return (
            <div className="bg-[#1a1a1a] rounded-lg p-4 sm:p-6 border border-[rgba(255,255,255,0.1)] mb-6 sm:mb-8 shadow-xl shadow-black/10">
              <div className="flex items-center gap-2 mb-4">
                <CalendarIcon className="w-5 h-5 text-[#a32020]" />
                <h2>Upcoming Appointments</h2>
              </div>
              {upcoming.length === 0 ? (
                <p className="text-[#a0a0a0] text-sm">No upcoming approved appointments.</p>
              ) : (
                <div className="divide-y divide-[rgba(255,255,255,0.06)]">
                  {upcoming.map((b) => (
                    <div key={b.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-[#e5e5e5] font-medium">{b.clientName}</p>
                        <p className="text-[#a0a0a0] text-sm line-clamp-1">{b.tattooIdea}</p>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="text-[#e5e5e5] text-sm">{b.date}</p>
                        <p className="text-[#a0a0a0] text-xs">{b.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Booking List */}
        <div>
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2>Booking Requests</h2>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-[rgba(255,255,255,0.1)] overflow-hidden">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 transition-colors ${viewMode === "grid" ? "bg-[#a32020]/20 text-[#a32020]" : "text-[#a0a0a0] hover:text-[#e5e5e5] hover:bg-[#1a1a1a]"}`}
                  title="Grid view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("card")}
                  className={`p-2 transition-colors ${viewMode === "card" ? "bg-[#a32020]/20 text-[#a32020]" : "text-[#a0a0a0] hover:text-[#e5e5e5] hover:bg-[#1a1a1a]"}`}
                  title="Card view"
                >
                  <LayoutList className="w-4 h-4" />
                </button>
              </div>
              <Button
                variant="ghost"
                onClick={fetchBookings}
                className="text-[#e5e5e5] hover:text-[#a32020] hover:bg-[#a32020]/10"
              >
                {loadingBookings ? "Refreshing…" : "Refresh"}
              </Button>
            </div>
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

          <div className={viewMode === "grid" ? "grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" : "grid grid-cols-1 lg:grid-cols-2 gap-4"}>
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
                  onCancel={handleCancel}
                  onDelete={handleDelete}
                  compact={viewMode === "grid"}
                />
              ))
            ) : (
              <div className="col-span-full bg-[#1a1a1a] rounded-lg p-12 border border-[rgba(255,255,255,0.1)] text-center">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-[#a0a0a0]" />
                <h3 className="mb-2 text-[#e5e5e5]">No bookings found</h3>
                <p className="text-[#a0a0a0]">
                  There are no {activeFilter} bookings
                  at the moment.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    <TutorialModal open={showTutorial} onClose={() => setShowTutorial(false)} />
    </>
  );
}
