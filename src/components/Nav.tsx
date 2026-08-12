"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const primaryLinks = [
  { href: "/dienstplan", label: "Plan", full: "Dienstplan", icon: "▦" },
  { href: "/urlaub", label: "Urlaub", full: "Urlaubsplaner", icon: "☀" },
  { href: "/abwesenheiten", label: "Krank", full: "Abwesenheiten", icon: "+" },
  { href: "/mitarbeiter", label: "Team", full: "Mitarbeiter", icon: "◎" },
];

const moreLinks = [
  { href: "/kompetenzen", label: "Kompetenzen" },
  { href: "/schichten", label: "Schichten" },
  { href: "/stunden", label: "Stunden" },
];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  const allDesktop = [
    { href: "/dienstplan", label: "Dienstplan" },
    { href: "/urlaub", label: "Urlaubsplaner" },
    { href: "/mitarbeiter", label: "Mitarbeiter" },
    { href: "/kompetenzen", label: "Kompetenzen" },
    { href: "/schichten", label: "Schichten" },
    { href: "/abwesenheiten", label: "Abwesenheiten" },
    { href: "/stunden", label: "Stunden" },
  ];

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      <header className="border-b border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/dienstplan" className="flex items-baseline gap-2 min-w-0">
            <span className="font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--ink)] sm:text-2xl">
              Schichtwerk
            </span>
            <span className="hidden text-xs uppercase tracking-[0.18em] text-[var(--muted)] md:inline">
              Dienstplan
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex flex-wrap items-center gap-1">
            {allDesktop.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                  isActive(l.href)
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--ink-soft)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Tablet/mobile top menu button */}
          <button
            type="button"
            className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--line)] bg-white text-[var(--ink)]"
            aria-label="Menü"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="text-lg leading-none">{open ? "✕" : "☰"}</span>
          </button>
        </div>

        {open ? (
          <div className="lg:hidden border-t border-[var(--line)] bg-[var(--surface)] px-4 py-3 animate-fade-up">
            <div className="grid grid-cols-2 gap-2">
              {allDesktop.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-lg px-3 py-3 text-sm font-medium ${
                    isActive(l.href)
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--surface-2)] text-[var(--ink)]"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      {/* Mobile bottom bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 border-t border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-0.5 px-1 py-1">
          {primaryLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-medium ${
                isActive(l.href)
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)]"
              }`}
            >
              <span className="text-base leading-none" aria-hidden>
                {l.icon}
              </span>
              {l.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-medium ${
              moreOpen || moreLinks.some((l) => isActive(l.href))
                ? "bg-[var(--surface-2)] text-[var(--ink)]"
                : "text-[var(--muted)]"
            }`}
          >
            <span className="text-base leading-none" aria-hidden>
              ···
            </span>
            Mehr
          </button>
        </div>
        {moreOpen ? (
          <div className="border-t border-[var(--line)] px-3 py-2 flex gap-2">
            {moreLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`flex-1 rounded-lg px-3 py-2.5 text-center text-sm font-medium ${
                  isActive(l.href)
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--surface-2)] text-[var(--ink)]"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        ) : null}
      </nav>
    </>
  );
}
