"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import PublicLayout from "./PublicLayout";
import AppShell from "./AppShell";

// Pages that get the public layout (no sidebar)
const PUBLIC_PATHS = ["/", "/docks", "/info", "/faq", "/marketplace", "/interest", "/news"];

// Pages that get NO layout wrapper at all (login, setup)
const BARE_PATHS = ["/login", "/setup", "/map"];

export default function LayoutRouter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { needsSetup, loading } = useAuth();

  // Redirect to /setup when authenticated but missing Firestore profile
  useEffect(() => {
    if (!loading && needsSetup && pathname !== "/setup" && pathname !== "/login") {
      router.replace("/setup");
    }
  }, [loading, needsSetup, pathname, router]);

  // Login / setup — no shell at all
  if (BARE_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  // Public pages — top navbar + footer
  if (PUBLIC_PATHS.includes(pathname)) {
    return <PublicLayout>{children}</PublicLayout>;
  }

  // Everything else — admin sidebar layout
  return <AppShell>{children}</AppShell>;
}
