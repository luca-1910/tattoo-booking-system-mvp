"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowserClient";

export function useRequireAdmin() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const run = async () => {
      const supabase = supabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();

      const allowedEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      const allowedUid = process.env.NEXT_PUBLIC_ADMIN_UID;

      const emailOk = allowedEmail ? user?.email === allowedEmail : true;
      const uidOk = allowedUid ? user?.id === allowedUid : true;

      if (!user || !(emailOk && uidOk)) {
        router.replace("/admin/login");
        return;
      }
      setChecking(false);
    };
    run();
  }, [router]);

  return checking; // true while verifying
}
