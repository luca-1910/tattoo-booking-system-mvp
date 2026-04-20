"use client";
import { Suspense } from "react";
import { withRouteHandlers } from "@/components/providers/RouteProvider";
import SettingsPage from "@/components/SettingsPage";

const Page = withRouteHandlers(SettingsPage);

export default function SettingsRoute() {
  return (
    <Suspense>
      <Page />
    </Suspense>
  );
}
