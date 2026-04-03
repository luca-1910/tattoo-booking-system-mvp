// src/lib/supabaseBrowserClient.ts
"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnvForBrowserClient } from "@/lib/env";

export const supabaseBrowser = () =>
  createBrowserClient(
    getPublicEnvForBrowserClient("NEXT_PUBLIC_SUPABASE_URL"),
    getPublicEnvForBrowserClient("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
