"use client";

import { useState, useMemo } from "react";
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { useRequireAdmin } from "@/hooks/useRequireAdmin"; // ✅ guard hook
import { supabaseBrowser } from "@/lib/supabaseBrowserClient"; 

type FilterTab = "all" | "pending" | "approved" | "completed" | "rejected" | "cancelled" | "expired";

interface DashboardProps {
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

const initialBookings = [/* ... your mock data unchanged ... */];

const chartData = [
  { month: "Jan", hoursWorked: 120, hoursAvailable: 160 },
  { month: "Feb", hoursWorked: 145, hoursAvailable: 160 },
  { month: "Mar", hoursWorked: 130, hoursAvailable: 160 },
  { month: "Apr", hoursWorked: 155, hoursAvailable: 160 },
  { month: "May", hoursWorked: 140, hoursAvailable: 160 },
  { month: "Jun", hoursWorked: 150, hoursAvailable: 160 },
];

export default function Dashboard({ onNavigate, onLogout }: DashboardProps) {
  const checking = useRequireAdmin(); // ✅ ensure only admin sees it
  const [bookings, setBookings] = useState(initialBookings);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

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
    [bookings]
  );

  const handleApprove = (id: number) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: "approved" as const } : b))
    );
    toast.success("Booking approved successfully");
  };

  const handleReject = (id: number) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: "rejected" as const } : b))
    );
    toast.error("Booking rejected");
  };

const handleLogout = async () => {
  const supabase = supabaseBrowser();

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
          <StatsCard title="Pending" value={stats.pending} icon={<Clock />} color="#f59e0b" />
          <StatsCard title="Approved" value={stats.approved} icon={<CheckCircle />} color="#10b981" />
          <StatsCard title="Rejected" value={stats.rejected} icon={<XCircle />} color="#ef4444" />
          <StatsCard title="Completed" value={stats.completed} icon={<CheckCircle />} color="#3b82f6" />
        </div>

        {/* Chart */}
        <div className="bg-[#1a1a1a] rounded-lg p-4 sm:p-6 border border-[rgba(255,255,255,0.1)] mb-6 sm:mb-8 shadow-xl shadow-black/10">
          <div className="flex items-center gap-2 mb-4 sm:mb-6">
            <BarChart3 className="w-5 h-5 text-[#a32020]" />
            <h2>Hours Worked vs Available</h2>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
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
              <Bar dataKey="hoursAvailable" fill="#2a2a2a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Booking List */}
        <div>
          <h2 className="mb-4 sm:mb-6">Booking Requests</h2>
          <div className="bg-[#1a1a1a] rounded-lg p-2 sm:p-4 border border-[rgba(255,255,255,0.1)] mb-6 shadow-xl shadow-black/10">
            <div className="flex overflow-x-auto gap-1 sm:gap-2 scrollbar-hide">
              {filterTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
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
            {filteredBookings.length > 0 ? (
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
                  There are no {activeFilter !== "all" && activeFilter} bookings at the moment.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
