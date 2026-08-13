import { NextResponse } from "next/server";

/** Einheitliche Fehlerantwort für API-Routen */
export function apiError(error: unknown, fallback = "Unerwarteter Serverfehler") {
  console.error(error);
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message, ok: false }, { status: 500 });
}
