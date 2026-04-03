"use client";

import dynamic from "next/dynamic";
import { withRouteHandlers } from "@/components/providers/RouteProvider";

const AdminLogin = dynamic(
  () => import("@/components/AdminLogin").then((mod) => mod.AdminLogin),
  { ssr: false },
);

export default withRouteHandlers(AdminLogin);
