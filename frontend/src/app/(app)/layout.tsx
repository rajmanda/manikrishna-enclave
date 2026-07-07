"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/shell/AppShell";
import { PageLoading } from "@/components/ui";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <PageLoading label="Checking your session…" />
      </div>
    );
  }

  return (
    <AppShell>
      {/* Keyed on the route so the CSS entrance replays on every navigation.
          Transform-only (see .animate-enter) → content is always visible even
          if the animation never runs. */}
      <div key={pathname} className="animate-enter">
        {children}
      </div>
    </AppShell>
  );
}
