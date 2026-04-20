"use client";

import React from "react";
import { useRouter } from "next/navigation";

export function useRouteHandlers() {
  const router = useRouter();

  // Map Figma navigation tokens → real routes
  const routeMap: Record<string, string> = {
    home: "/",
    booking: "/booking",
    "admin-login": "/admin/login",
    dashboard: "/dashboard",
    calendar: "/calendar",
    settings: "/settings",
  };

  const onNavigate = (target: string) => {
    // If target already looks like a path, use it directly
    if (target.startsWith("/")) {
      router.push(target);
      return;
    }

    // Otherwise map Figma token to a route
    const path = routeMap[target];
    if (path) {
      router.push(path);
    } else {
}
  };

  const onLogin = () => router.push("/dashboard");
  const onLogout = () => router.push("/admin/login");

  return { onNavigate, onLogin, onLogout };
}

/**
 * HOC that injects route handlers as props into a component-based page.
 * Keeps Figma-style navigation tokens compatible with Next.js routing.
 */
export function withRouteHandlers<P extends object>(
  Component: React.ComponentType<P>,
) {
  return function RoutedPage(props: Omit<P, "onNavigate" | "onLogin" | "onLogout">) {
    const handlers = useRouteHandlers();
    return <Component {...(props as P)} {...handlers} />;
  };
}
