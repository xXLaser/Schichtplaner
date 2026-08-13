"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Nav } from "@/components/Nav";

type OnboardingStatus = {
  completed: boolean;
  step: string;
};

type AuthState = {
  authRequired: boolean;
  user: { id: string; username: string } | null;
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSetup = pathname === "/setup" || pathname.startsWith("/setup/");
  const isLogin = pathname === "/login";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [onboardingRes, authRes] = await Promise.all([
          fetch("/api/onboarding", { cache: "no-store" }),
          fetch("/api/auth/me", { cache: "no-store" }),
        ]);
        const onboarding = await onboardingRes.json();
        const authJson = await authRes.json();
        if (!onboardingRes.ok) {
          throw new Error(onboarding.error ?? `Fehler ${onboardingRes.status}`);
        }
        if (!cancelled) {
          setStatus(onboarding);
          setAuth(
            authRes.ok
              ? {
                  authRequired: Boolean(authJson.authRequired),
                  user: authJson.user ?? null,
                }
              : { authRequired: false, user: null },
          );
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Status unbekannt");
          // Bei API-Fehler App nicht blockieren (z. B. alte DB ohne Migration)
          setStatus({ completed: true, step: "done" });
          setAuth({ authRequired: false, user: null });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (!status) return;
    if (!status.completed && !isSetup) {
      router.replace("/setup");
      return;
    }
    if (status.completed && isSetup) {
      router.replace("/dienstplan");
      return;
    }
    if (
      status.completed &&
      auth?.authRequired &&
      !auth.user &&
      !isLogin &&
      !isSetup
    ) {
      router.replace("/login");
    }
  }, [status, isSetup, isLogin, auth, router]);

  if (!status || !auth) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-[var(--muted)]">
        {error ? error : "Schichtwerk wird geladen…"}
      </div>
    );
  }

  if (!status.completed) {
    return (
      <>
        <header className="border-b border-[var(--line)] bg-[var(--surface)]">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
            <Link href="/setup" className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
              Schichtwerk
            </Link>
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Ersteinrichtung
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
          {isSetup ? children : null}
        </main>
      </>
    );
  }

  if (auth.authRequired && !auth.user) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        {isLogin ? children : null}
      </main>
    );
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 sm:py-10 lg:pb-10">
        {children}
      </main>
    </>
  );
}
