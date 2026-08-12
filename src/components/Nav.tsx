"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dienstplan", label: "Dienstplan" },
  { href: "/mitarbeiter", label: "Mitarbeiter" },
  { href: "/kompetenzen", label: "Kompetenzen" },
  { href: "/schichten", label: "Schichten" },
  { href: "/abwesenheiten", label: "Abwesenheiten" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-[var(--line)] bg-[var(--surface)]/90 backdrop-blur-md sticky top-0 z-40">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/dienstplan" className="group flex items-baseline gap-2">
          <span className="font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--ink)] sm:text-2xl">
            Schichtwerk
          </span>
          <span className="hidden text-xs uppercase tracking-[0.18em] text-[var(--muted)] sm:inline">
            Dienstplan
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--ink-soft)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
