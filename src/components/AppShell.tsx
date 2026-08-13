"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Nav } from "@/components/Nav";

type SessionState = {
  completed: boolean;
  needsLogin: boolean;
  hasUsers: boolean;
  user: { username: string } | null;
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSetup = pathname === "/setup" || pathname.startsWith("/setup/");
  const isLogin = pathname === "/login";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? `Fehler ${res.status}`);
        }
        if (!cancelled) {
          setStatus({
            completed: Boolean(json.onboarding?.completed),
            needsLogin: Boolean(json.needsLogin),
            hasUsers: Boolean(json.hasUsers),
            user: json.user ?? null,
          });
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Status unbekannt");
          setStatus({
            completed: true,
            needsLogin: false,
            hasUsers: false,
            user: null,
          });
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
    if (!status.completed && !isSetup && !isLogin) {
      router.replace("/setup");
      return;
    }
    if (status.completed && isSetup) {
      router.replace("/dienstplan");
      return;
    }
    if (status.needsLogin && !isLogin && !isSetup) {
      router.replace("/login");
    }
    if (status.completed && !status.needsLogin && isLogin) {
      router.replace("/dienstplan");
    }
  }, [status, isSetup, isLogin, router]);

  if (!status) {
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
          {isSetup || isLogin ? children : null}
        </main>
      </>
    );
  }

  if (status.needsLogin) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        {isLogin ? children : null}
      </main>
    );
  }

  return (
    <>
      <Nav username={status.user?.username} />
      <main className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 sm:py-10 lg:pb-10">
        {children}
      </main>
    </>
  );
}
