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

  // NEW: keep artist_id we’ll key settings by
  const [artistId, setArtistId] = useState<string | null>(null);

  // we don’t actually need settingsId anymore when keying by artist_id, but keep it harmlessly
  const [settingsId, setSettingsId] = useState<number | null>(null);

  const [artistName, setArtistName] = useState("");
  const [calendarId, setCalendarId] = useState("");
  const [googleCalendarSyncEnabled, setGoogleCalendarSyncEnabled] = useState(false);

  const [authEmail, setAuthEmail] = useState("");
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    pushNotifications: false,
    bookingReminders: true,
    marketingEmails: false,
  });
  const [appearance, setAppearance] = useState({ darkMode: true });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (checking) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        // show auth email for display
        const { data: userRes } = await supabase.auth.getUser();
        if (userRes?.user?.email) setAuthEmail(userRes.user.email);

        // 1) fetch the single artist_id from core table
        const { data: artistRow, error: artistErr } = await supabase
          .schema("artist_core")
          .from("tattoo_artist")
          .select("artist_id")
          .limit(1)
          .maybeSingle();

        if (artistErr) {
          toast.error(artistErr.message);
          return;
        }
        if (!artistRow?.artist_id) {
          toast.error("No artist found in artist_core.tattoo_artist.");
          return;
        }
        const id = artistRow.artist_id as string;
        setArtistId(id);

        // 2) load settings for that artist_id
        const { data: settings, error: settingsErr } = await supabase
          .from("artist_settings")
          .select("*")
          .eq("artist_id", id)
          .maybeSingle();

        if (settingsErr) {
          toast.error(settingsErr.message);
          return;
        }

        if (settings) {
          setSettingsId((settings as any).id ?? null);
          setArtistName(settings.name ?? "");
          setCalendarId(settings.calendar_id ?? "");
          setGoogleCalendarSyncEnabled(Boolean(settings.google_calendar_sync_enabled));
        } else {
          // no row yet—leave UI empty, we’ll upsert on save
          setSettingsId(null);
          setArtistName("");
          setCalendarId("");
          setGoogleCalendarSyncEnabled(false);
        }
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

      // Upsert keyed by artist_id so we always maintain a single row per artist
      const { error } = await supabase
        .from("artist_settings")
        .upsert(
          {
            artist_id: artistId, // ← REQUIRED
            name: artistName,
            calendar_id: calendarId,
            google_calendar_sync_enabled: googleCalendarSyncEnabled,
          },
          { onConflict: "artist_id" }
        )
        .select()
        .maybeSingle();

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
          <Button variant="ghost" onClick={() => history.back()} className="mb-4 text-[#e5e5e5] hover:text-[#a32020]">
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

                <div className="flex gap-3 pt-2">
                  <Button onClick={handleSave} disabled={saving} className="bg-[#a32020] hover:bg-[#8a1b1b] text-white">
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? "Saving…" : "Save Profile"}
                  </Button>
                </div>
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
                    <p className="text-[#a0a0a0]">When enabled, approved bookings are pushed to your calendar.</p>
                  </div>
                  <Switch checked={googleCalendarSyncEnabled} onCheckedChange={setGoogleCalendarSyncEnabled} />
                </div>

                <Button onClick={handleSave} disabled={saving} className="bg-[#a32020] hover:bg-[#8a1b1b] text-white">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Saving…" : "Save Calendar Settings"}
                </Button>
              </div>
            </div>

            {/* Notifications (UI only) */}
            <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[rgba(255,255,255,0.1)]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#a32020]/10 rounded-lg flex items-center justify-center">
                  <Bell className="w-5 h-5 text-[#a32020]" />
                </div>
                <h2 className="text-xl font-medium">Notifications</h2>
              </div>

              {[
                ["Email Notifications", "Receive booking updates via email", "emailNotifications"],
                ["Push Notifications", "Get instant alerts on your device", "pushNotifications"],
                ["Booking Reminders", "Reminders for upcoming appointments", "bookingReminders"],
                ["Marketing Emails", "Updates and promotional content", "marketingEmails"],
              ].map(([title, subtitle, key]) => (
                <div key={key} className="flex items-center justify-between p-4 bg-[#0a0a0a] rounded-lg mb-3">
                  <div>
                    <p className="text-[#e5e5e5]">{title}</p>
                    <p className="text-[#a0a0a0]">{subtitle}</p>
                  </div>
                  <Switch
                    checked={notifications[key as keyof typeof notifications]}
                    onCheckedChange={() =>
                      setNotifications((prev) => ({
                        ...prev,
                        [key]: !prev[key as keyof typeof notifications],
                      }))
                    }
                  />
                </div>
              ))}
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
                  onCheckedChange={() => setAppearance((p) => ({ ...p, darkMode: !p.darkMode }))}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="bg-[#a32020] hover:bg-[#8a1b1b] text-white">
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
