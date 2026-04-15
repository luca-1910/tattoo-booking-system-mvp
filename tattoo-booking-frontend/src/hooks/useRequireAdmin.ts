"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Guards admin-only pages. Calls /api/auth/me (server-side check) to verify
 * the current session has admin privileges.
 *
 * Returns:
 *   checking        — true while the auth check is in-flight
 *   hasArtistProfile — whether the tattoo_artist row exists for this admin
 *
 * Callers that need the full onboarding gate should redirect to /settings when
 * checking === false && hasArtistProfile === false.
 *
 * No NEXT_PUBLIC_ env vars are read here — credentials never enter the bundle.
 */
export function useRequireAdmin() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasArtistProfile, setHasArtistProfile] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.replace("/admin/login");
          return;
        }
        const data = await res.json();
        if (!data.isAdmin) {
          router.replace("/admin/login");
          return;
        }
        setHasArtistProfile(Boolean(data.hasArtistProfile));
        setChecking(false);
      } catch {
        // Network error or unexpected failure — fail closed.
        router.replace("/admin/login");
      }
    };
    run();
  }, [router]);

  return checking; // true while verifying (hasArtistProfile is the companion)
}

/**
 * Same as useRequireAdmin but also redirects to /settings if no artist profile
 * row exists yet. Use on pages that require a completed onboarding (Dashboard,
 * Calendar). SettingsPage itself should use useRequireAdmin directly so the
 * onboarding form can render.
 */
export function useRequireArtistProfile() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.replace("/admin/login");
          return;
        }
        const data = await res.json();
        if (!data.isAdmin) {
          router.replace("/admin/login");
          return;
        }
        if (!data.hasArtistProfile) {
          router.replace("/settings");
          return;
        }
        setChecking(false);
      } catch {
        router.replace("/admin/login");
      }
    };
    run();
  }, [router]);

  return checking;
}
