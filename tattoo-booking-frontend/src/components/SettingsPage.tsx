"use client";

import { useState, useEffect } from "react";
import { useRequireAdmin } from "@/hooks/useRequireAdmin";
import { supabaseBrowser } from "@/lib/supabaseBrowserClient";
import { Button } from "./ui/button";
import { toast } from "sonner";

export default function SettingsPage() {
  const checking = useRequireAdmin();
  const supabase = supabaseBrowser();

  // hooks all first
  const [artistName, setArtistName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (checking) return;
    const fetchArtist = async () => {
      setLoading(true);
      const { data, error } = await supabase.from("tattoo_artist").select("*").limit(1).single();
      if (error) toast.error(error.message);
      else setArtistName(data.name || "");
      setLoading(false);
    };
    fetchArtist();
  }, [checking, supabase]);

  // guard AFTER hooks
  if (checking) return null;

  return (
    <div className="p-6 text-white bg-[#0a0a0a] min-h-screen">
      <h1 className="text-2xl font-semibold mb-4">Settings</h1>
      {loading ? (
        <p>Loading settings...</p>
      ) : (
        <div className="space-y-4">
          <p>
            <strong>Artist Name:</strong> {artistName}
          </p>
          <Button
            className="bg-[#a32020] hover:bg-[#8a1b1b]"
            onClick={() => toast.success("Settings updated (placeholder)")}
          >
            Save Changes
          </Button>
        </div>
      )}
    </div>
  );
}
