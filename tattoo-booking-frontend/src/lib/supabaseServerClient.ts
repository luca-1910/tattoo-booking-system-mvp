/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/supabaseServerClient.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const supabaseServer = () =>
  createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookies().get(name)?.value,
        set: (name: string, value: string, options: any) =>
          cookies().set({ name, value, ...options }),
        remove: (name: string, options: any) =>
          cookies().set({ name, value: "", ...options }),
      },
    }
  );
