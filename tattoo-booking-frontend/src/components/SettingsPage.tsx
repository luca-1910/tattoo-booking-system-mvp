/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { User, Palette, Save, Calendar as CalendarIcon, MapPin, Share2, LayoutDashboard, LogOut, ChevronRight, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { useRequireAdmin } from "@/hooks/useRequireAdmin";
import { supabaseBrowser } from "@/lib/supabaseBrowserClient";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { toast } from "sonner";

interface SettingsPageProps {
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export default function SettingsPage({ onNavigate, onLogout }: SettingsPageProps) {
  const checking = useRequireAdmin();
  const supabase = supabaseBrowser();
  const searchParams = useSearchParams();

  // Artist identity
  const [artistId, setArtistId] = useState<string | null>(null);
  const [artistName, setArtistName] = useState("");
  const [tagline, setTagline] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Calendar
  const [calendarId, setCalendarId] = useState("");
  const [googleCalendarSyncEnabled, setGoogleCalendarSyncEnabled] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isGoogleUser, setIsGoogleUser] = useState(false);

  // Studio location & hours
  const [addressStreet, setAddressStreet] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [hoursWeekday, setHoursWeekday] = useState("");
  const [hoursWeekend, setHoursWeekend] = useState("");

  // Social & links
  const [instagramUrl, setInstagramUrl] = useState("");
  const [shopUrl, setShopUrl] = useState("");

  // Landing page images
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [portfolioImages, setPortfolioImages] = useState<[string, string, string]>(["", "", ""]);

  // UI state
  const [authEmail, setAuthEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState("profile");
  const [mobileShowContent, setMobileShowContent] = useState(false);

  // Onboarding state — shown when no artist row exists yet
  const [isNewArtist, setIsNewArtist] = useState(false);
  const [initName, setInitName] = useState("");
  const [initEmail, setInitEmail] = useState("");
  const [initSaving, setInitSaving] = useState(false);

  const navItems = [
    { id: "profile", label: "Profile", icon: <User className="w-4 h-4" /> },
    { id: "studio", label: "Studio", icon: <MapPin className="w-4 h-4" /> },
    { id: "social", label: "Social & Links", icon: <Share2 className="w-4 h-4" /> },
    { id: "images", label: "Landing Images", icon: <Palette className="w-4 h-4" /> },
    { id: "calendar", label: "Calendar", icon: <CalendarIcon className="w-4 h-4" /> },
  ];

  useEffect(() => {
    if (checking) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr) { toast.error(userErr.message); return; }

        const user = userRes?.user;
        if (!user) { toast.error("No active session."); return; }

        if (user.email) setAuthEmail(user.email);
        setIsGoogleUser(user.app_metadata?.provider === "google");

        const { data: artist, error } = await supabase
          .from("tattoo_artist")
          .select(`
            artist_id, name, calendar_id, google_calendar_sync_enabled,
            tagline, contact_email, phone,
            address_street, address_city, hours_weekday, hours_weekend,
            instagram_url, shop_url, hero_image_url, portfolio_images,
            google_refresh_token
          `)
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (error) { toast.error(error.message); return; }
        if (!artist?.artist_id) {
          // No row yet — show the first-time setup form
          setInitName(user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "");
          setInitEmail(user.email ?? "");
          setIsNewArtist(true);
          return;
        }

        setArtistId(artist.artist_id);
        setIsGoogleConnected(Boolean(artist.google_refresh_token));
        setArtistName(artist.name ?? "");
        setCalendarId(artist.calendar_id ?? "");
        setGoogleCalendarSyncEnabled(Boolean(artist.google_calendar_sync_enabled));
        setTagline(artist.tagline ?? "");
        setContactEmail(artist.contact_email ?? "");
        setPhone(artist.phone ?? "");
        setAddressStreet(artist.address_street ?? "");
        setAddressCity(artist.address_city ?? "");
        setHoursWeekday(artist.hours_weekday ?? "");
        setHoursWeekend(artist.hours_weekend ?? "");
        setInstagramUrl(artist.instagram_url ?? "");
        setShopUrl(artist.shop_url ?? "");
        setHeroImageUrl(artist.hero_image_url ?? "");

        const imgs = Array.isArray(artist.portfolio_images) ? artist.portfolio_images : [];
        setPortfolioImages([imgs[0] ?? "", imgs[1] ?? "", imgs[2] ?? ""]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [checking, supabase]);

  // Show toast when redirected back after Google Calendar OAuth
  useEffect(() => {
    const googleParam = searchParams.get("google");
    if (googleParam === "connected") {
      setIsGoogleConnected(true);
      toast.success("Google Calendar connected successfully.");
    } else if (googleParam === "error") {
      const reason = searchParams.get("reason");
      toast.error(reason === "db_write" ? "Connected but failed to save tokens. Try again." : "Google Calendar connection failed. Please try again.");
    }
  }, [searchParams]);

  const handleSave = async () => {
    if (!artistId) { toast.error("Artist not loaded yet."); return; }

    try {
      setSaving(true);

      const { error } = await supabase
        .from("tattoo_artist")
        .update({
          name: artistName,
          calendar_id: calendarId,
          google_calendar_sync_enabled: googleCalendarSyncEnabled,
          tagline,
          contact_email: contactEmail,
          phone,
          address_street: addressStreet,
          address_city: addressCity,
          hours_weekday: hoursWeekday,
          hours_weekend: hoursWeekend,
          instagram_url: instagramUrl,
          shop_url: shopUrl,
          hero_image_url: heroImageUrl,
          portfolio_images: portfolioImages.filter(Boolean),
        })
        .eq("artist_id", artistId);

      if (error) throw error;
      toast.success("Settings saved.");
    } catch (e: any) {
      toast.error(e.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const updatePortfolioImage = (index: number, value: string) => {
    setPortfolioImages((prev) => {
      const next: [string, string, string] = [...prev] as [string, string, string];
      next[index] = value;
      return next;
    });
  };

  const handleCreateProfile = async () => {
    try {
      setInitSaving(true);
      const res = await fetch("/api/admin/artist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: initName, contactEmail: initEmail }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to create profile.");
      // Row created — reload so fetchData picks up the new row
      window.location.reload();
    } catch (e: any) {
      toast.error(e.message || "Failed to create profile.");
    } finally {
      setInitSaving(false);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) { toast.error("Failed to log out. Please try again."); return; }
    toast.success("Logged out successfully");
    onLogout();
  };

  if (checking || loading) return null;

  if (isNewArtist) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#1a1a1a] rounded-xl border border-[rgba(255,255,255,0.1)] p-8 shadow-xl shadow-black/20">
          <h1 className="text-xl font-semibold mb-2">Welcome — set up your profile</h1>
          <p className="text-[#a0a0a0] text-sm mb-6">
            No artist profile found. Enter your details below to get started.
          </p>

          <div className="space-y-4">
            <div>
              <Label htmlFor="init-name">Display name</Label>
              <Input
                id="init-name"
                value={initName}
                onChange={(e) => setInitName(e.target.value)}
                placeholder="e.g. MissMay Tattoos"
                className="mt-1 bg-[#0a0a0a] border-[rgba(255,255,255,0.1)] text-[#e5e5e5]"
              />
            </div>
            <div>
              <Label htmlFor="init-email">Contact email</Label>
              <Input
                id="init-email"
                type="email"
                value={initEmail}
                onChange={(e) => setInitEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 bg-[#0a0a0a] border-[rgba(255,255,255,0.1)] text-[#e5e5e5]"
              />
            </div>
          </div>

          <Button
            onClick={handleCreateProfile}
            disabled={initSaving || !initName.trim()}
            className="w-full mt-6 bg-[#a32020] hover:bg-[#c02828] text-white"
          >
            {initSaving ? "Creating…" : "Create profile"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5]">
      {/* Top Navigation */}
      <div className="border-b border-[rgba(255,255,255,0.1)] bg-[#1a1a1a] sticky top-0 z-50 shadow-lg shadow-black/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1>Settings</h1>
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
              onClick={() => onNavigate("calendar")}
              className="text-[#e5e5e5] hover:text-[#a32020] hover:bg-[#a32020]/10 sm:w-auto sm:px-4"
            >
              <CalendarIcon className="w-5 h-5" />
              <span className="hidden sm:inline ml-2">Calendar</span>
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

      <div className="max-w-6xl mx-auto py-8 px-4 md:flex md:gap-8">
        {/* Sidebar — always visible on md+, hidden on mobile when content is shown */}
        <aside className={`md:w-48 md:shrink-0 ${mobileShowContent ? "hidden md:block" : "block"}`}>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { setActiveSection(item.id); setMobileShowContent(true); }}
                className={`flex items-center justify-between gap-3 px-3 py-3 md:py-2.5 rounded-lg text-sm text-left transition-colors ${
                  activeSection === item.id && mobileShowContent
                    ? "bg-[#a32020]/15 text-[#e5e5e5] font-medium"
                    : "text-[#a0a0a0] hover:bg-[#1a1a1a] hover:text-[#e5e5e5]"
                }`}
              >
                <span className="flex items-center gap-3">
                  {item.icon}
                  {item.label}
                </span>
                <ChevronRight className="w-4 h-4 md:hidden opacity-40" />
              </button>
            ))}
          </nav>
        </aside>

        {/* Content — always visible on md+, only shown on mobile when drilled in */}
        <div className={`flex-1 min-w-0 ${mobileShowContent ? "block" : "hidden md:block"}`}>
          {/* Mobile back button */}
          <button
            onClick={() => setMobileShowContent(false)}
            className="md:hidden flex items-center gap-2 text-sm text-[#a0a0a0] hover:text-[#e5e5e5] mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          {loading ? (
            <p className="text-[#a0a0a0]">Loading settings…</p>
          ) : (
            <>
              {activeSection === "profile" && (
                <Section icon={<User />} title="Profile Information">
                  <Field label="Artist Name">
                    <Input value={artistName} onChange={(e) => setArtistName(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Tagline" hint="Shown as the subtitle on the landing page">
                    <Input value={tagline} placeholder="Fine line artistry. Dark minimalism." onChange={(e) => setTagline(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Public Contact Email">
                    <Input type="email" value={contactEmail} placeholder="hello@yourstudio.com" onChange={(e) => setContactEmail(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Phone">
                    <Input value={phone} placeholder="+1 (555) 123-4567" onChange={(e) => setPhone(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Auth Email (read-only)">
                    <Input type="email" value={authEmail} readOnly className={`${inputCls} text-[#a0a0a0] cursor-not-allowed`} />
                  </Field>
                </Section>
              )}

              {activeSection === "studio" && (
                <Section icon={<MapPin />} title="Studio Location & Hours">
                  <Field label="Street Address">
                    <Input value={addressStreet} placeholder="123 Ink Street" onChange={(e) => setAddressStreet(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="City / State">
                    <Input value={addressCity} placeholder="Brooklyn, NY 11211" onChange={(e) => setAddressCity(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Weekday Hours">
                    <Input value={hoursWeekday} placeholder="Tue - Sat: 11AM - 7PM" onChange={(e) => setHoursWeekday(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Weekend / Closed Days">
                    <Input value={hoursWeekend} placeholder="Sun - Mon: Closed" onChange={(e) => setHoursWeekend(e.target.value)} className={inputCls} />
                  </Field>
                </Section>
              )}

              {activeSection === "social" && (
                <Section icon={<Share2 />} title="Social & Links">
                  <Field label="Instagram URL">
                    <Input value={instagramUrl} placeholder="https://instagram.com/yourstudio" onChange={(e) => setInstagramUrl(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Shop URL">
                    <Input value={shopUrl} placeholder="https://shop.yourstudio.com" onChange={(e) => setShopUrl(e.target.value)} className={inputCls} />
                  </Field>
                </Section>
              )}

              {activeSection === "images" && (
                <Section icon={<Palette />} title="Landing Page Images">
                  <Field label="Hero Background Image URL">
                    <Input value={heroImageUrl} placeholder="https://…" onChange={(e) => setHeroImageUrl(e.target.value)} className={inputCls} />
                  </Field>
                  {([0, 1, 2] as const).map((i) => (
                    <Field key={i} label={`Portfolio Image ${i + 1} URL`}>
                      <Input value={portfolioImages[i]} placeholder="https://…" onChange={(e) => updatePortfolioImage(i, e.target.value)} className={inputCls} />
                    </Field>
                  ))}
                </Section>
              )}

              {activeSection === "calendar" && (
                <Section icon={<CalendarIcon />} title="Calendar">
                  {/* Connection status */}
                  <div className="flex items-center justify-between p-4 bg-[#0a0a0a] rounded-lg">
                    <div>
                      <p className="text-[#e5e5e5] font-medium">Google Calendar Access</p>
                      <p className="text-[#a0a0a0] text-sm">
                        {isGoogleConnected
                          ? "Calendar access granted — sync is ready"
                          : "Calendar access not granted — click Connect below"}
                      </p>
                    </div>
                    {isGoogleConnected ? (
                      <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        Connected
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-sm text-red-400">
                        <XCircle className="w-4 h-4" />
                        Not connected
                      </span>
                    )}
                  </div>

                  {/* Connect button — shown whenever calendar access isn't confirmed.
                      Google Sign-In covers authentication but Supabase may not persist
                      the provider refresh token, so we always offer the explicit OAuth
                      flow so the app can create calendar events server-side. */}
                  {!isGoogleConnected && (
                    <a href="/api/google/start" className="block">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full bg-[#0a0a0a] border-[rgba(255,255,255,0.15)] text-[#e5e5e5] hover:bg-[#222] hover:border-[rgba(255,255,255,0.3)]"
                      >
                        Connect Google Calendar
                      </Button>
                    </a>
                  )}
                  {isGoogleConnected && (
                    <a href="/api/google/start" className="block">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full bg-[#0a0a0a] border-[rgba(255,255,255,0.15)] text-[#a0a0a0] hover:bg-[#222] hover:border-[rgba(255,255,255,0.3)] text-sm"
                      >
                        Re-authorise Google Calendar
                      </Button>
                    </a>
                  )}

                  <Field label="Google Calendar ID">
                    <Input value={calendarId} placeholder="primary or name@domain.com" onChange={(e) => setCalendarId(e.target.value)} className={inputCls} />
                  </Field>
                  <div className="flex items-center justify-between p-4 bg-[#0a0a0a] rounded-lg">
                    <div>
                      <p className="text-[#e5e5e5]">Enable Google Calendar Sync</p>
                      <p className="text-[#a0a0a0] text-sm">Approved bookings are pushed to your calendar.</p>
                    </div>
                    <Switch checked={googleCalendarSyncEnabled} onCheckedChange={setGoogleCalendarSyncEnabled} />
                  </div>
                </Section>
              )}

<div className="flex justify-end mt-6 pb-8">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-[#a32020] hover:bg-[#8a1b1b] text-white px-8"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Saving…" : "Save All Changes"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const inputCls = "mt-1 bg-[#0a0a0a] border-[rgba(255,255,255,0.1)] text-[#e5e5e5]";

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[rgba(255,255,255,0.1)]">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-[#a32020]/10 rounded-lg flex items-center justify-center text-[#a32020]">
          {icon}
        </div>
        <h2 className="text-xl font-medium">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {hint && <p className="text-[#a0a0a0] text-xs mt-0.5 mb-1">{hint}</p>}
      {children}
    </div>
  );
}
