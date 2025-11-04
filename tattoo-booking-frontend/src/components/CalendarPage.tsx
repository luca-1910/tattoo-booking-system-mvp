/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRequireAdmin } from "@/hooks/useRequireAdmin";
import { supabaseBrowser } from "@/lib/supabaseBrowserClient";
import { Button } from "./ui/button";
import { toast } from "sonner";

export default function CalendarPage() {
  const checking = useRequireAdmin();
  const supabase = supabaseBrowser();

  // all hooks stay at the top
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (checking) return;
    const fetchSlots = async () => {
      setLoading(true);
      const { data, error } = await supabase.from("slots").select("*");
      if (error) toast.error(error.message);
      else setSlots(data || []);
      setLoading(false);
    };
    fetchSlots();
  }, [checking, supabase]);

  const upcomingSlots = useMemo(
    () => slots.filter((s) => new Date(s.start_time) > new Date()),
    [slots]
  );

  // guard placed AFTER hooks
  if (checking) return null;

  return (
    <div className="p-6 text-white bg-[#0a0a0a] min-h-screen">
      <h1 className="text-2xl font-semibold mb-4">Calendar</h1>
      {loading ? (
        <p>Loading slots...</p>
      ) : (
        <ul className="space-y-2">
          {upcomingSlots.map((slot) => (
            <li
              key={slot.id}
              className="border border-gray-700 p-3 rounded-md flex justify-between"
            >
              <span>{new Date(slot.start_time).toLocaleString()}</span>
              <Button
                onClick={() => toast.info(`Slot ID: ${slot.id}`)}
                className="bg-[#a32020] hover:bg-[#8a1b1b]"
              >
                View
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
