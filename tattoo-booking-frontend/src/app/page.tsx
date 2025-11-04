"use client";

import { useRouter } from "next/navigation";
import { LandingPage } from "@/components/LandingPage";

export default function Page() {
  const router = useRouter();

  const handleNavigate = (page: string) => {
    switch (page) {
      case "booking":
        router.push("/booking");
        break;
      case "admin-login":
        router.push("/admin/login");
        break;
      case "dashboard":
        router.push("/dashboard");
        break;
      case "calendar":
        router.push("/calendar");
        break;
      case "settings":
        router.push("/settings");
        break;
      default:
        router.push("/");
    }
  };

  return <LandingPage onNavigate={handleNavigate} />;
}
