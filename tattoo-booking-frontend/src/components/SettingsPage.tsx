/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, User, Bell, Palette, Save, Calendar as CalendarIcon } from "lucide-react";
import { useRequireAdmin } from "@/hooks/useRequireAdmin";
import { supabaseBrowser } from "@/lib/supabaseBrowserClient";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { toast } from "sonner";

export default function SettingsPage() {
  const checking = useRequireAdmin();
  const supabase = supabaseBrowser();
  

  // Artist state
  const [artistId, setArtistId] = useState<string | null>(null);
  const [artistName, setArtistName] = useState("");
  const [calendarId, setCalendarId] = useState("");
  const [googleCalendarSyncEnabled, setGoogleCalendarSyncEnabled] = useState(false);

  // UI state
  const [authEmail, setAuthEmail] = useState("");
  const [appearance, setAppearance] = useState({ darkMode: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (checking) return;
    

    const fetchData = async () => {
      try {
        setLoading(true);

        // Auth email (display only)
        const { data: userRes } = await supabase.auth.getUser();
        if (userRes?.user?.email) {
          setAuthEmail(userRes.user.email);
        }

        // Fetch single artist (source of truth)
        const { data: artist, error } = await supabase
          .from("tattoo_artist")
          .select("artist_id, name, calendar_id, google_calendar_sync_enabled")
          .limit(1)
          .maybeSingle();

        if (error) {
          toast.error(error.message);
          return;
        }

        if (!artist?.artist_id) {
          toast.error("No artist found in tattoo_artist.");
          return;
        }

        // Hydrate state
        setArtistId(artist.artist_id);
        setArtistName(artist.name ?? "");
        setCalendarId(artist.calendar_id ?? "");
        setGoogleCalendarSyncEnabled(Boolean(artist.google_calendar_sync_enabled));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [checking, supabase]);

  const handleSave = async () => {
    if (!artistId) {
      toast.error("Artist not loaded yet.");
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from("tattoo_artist")
        .upsert(
          {
            artist_id: artistId, // PK
            name: artistName,
            calendar_id: calendarId,
            google_calendar_sync_enabled: googleCalendarSyncEnabled,
          },
          { onConflict: "artist_id" }
        );

      if (error) throw error;

      toast.success("Settings saved.");
    } catch (e: any) {
      toast.error(e.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (checking) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => history.back()}
            className="mb-4 text-[#e5e5e5] hover:text-[#a32020]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-semibold">Settings</h1>
        </div>

        {loading ? (
          <p className="text-[#a0a0a0]">Loading settings…</p>
        ) : (
          <div className="space-y-6">
            {/* Profile */}
            <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[rgba(255,255,255,0.1)]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#a32020]/10 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-[#a32020]" />
                </div>
                <h2 className="text-xl font-medium">Profile Information</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="artist-name">Artist Name</Label>
                  <Input
                    id="artist-name"
                    value={artistName}
                    onChange={(e) => setArtistName(e.target.value)}
                    className="mt-2 bg-[#0a0a0a] border-[rgba(255,255,255,0.1)] text-[#e5e5e5]"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email (from Auth)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={authEmail}
                    readOnly
                    className="mt-2 bg-[#0a0a0a] border-[rgba(255,255,255,0.1)] text-[#a0a0a0] cursor-not-allowed"
                  />
                </div>

                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-[#a32020] hover:bg-[#8a1b1b] text-white"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Saving…" : "Save Profile"}
                </Button>
              </div>
            </div>

            {/* Calendar */}
            <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[rgba(255,255,255,0.1)]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#a32020]/10 rounded-lg flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5 text-[#a32020]" />
                </div>
                <h2 className="text-xl font-medium">Calendar</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="calendar-id">Google Calendar ID</Label>
                  <Input
                    id="calendar-id"
                    placeholder="primary or name@domain.com"
                    value={calendarId}
                    onChange={(e) => setCalendarId(e.target.value)}
                    className="mt-2 bg-[#0a0a0a] border-[rgba(255,255,255,0.1)] text-[#e5e5e5]"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-[#0a0a0a] rounded-lg">
                  <div>
                    <p className="text-[#e5e5e5]">Enable Google Calendar Sync</p>
                    <p className="text-[#a0a0a0]">
                      When enabled, approved bookings are pushed to your calendar.
                    </p>
                  </div>
                  <Switch
                    checked={googleCalendarSyncEnabled}
                    onCheckedChange={setGoogleCalendarSyncEnabled}
                  />
                </div>

                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-[#a32020] hover:bg-[#8a1b1b] text-white"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Saving…" : "Save Calendar Settings"}
                </Button>
              </div>
            </div>

            {/* Appearance (UI only) */}
            <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[rgba(255,255,255,0.1)]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#a32020]/10 rounded-lg flex items-center justify-center">
                  <Palette className="w-5 h-5 text-[#a32020]" />
                </div>
                <h2 className="text-xl font-medium">Appearance</h2>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#0a0a0a] rounded-lg">
                <div>
                  <p className="text-[#e5e5e5]">Dark Mode</p>
                  <p className="text-[#a0a0a0]">Use dark theme across the app</p>
                </div>
                <Switch
                  checked={appearance.darkMode}
                  onCheckedChange={() =>
                    setAppearance((p) => ({ ...p, darkMode: !p.darkMode }))
                  }
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-[#a32020] hover:bg-[#8a1b1b] text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
