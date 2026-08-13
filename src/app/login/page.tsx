"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Panel, Button, Input } from "@/components/ui";
import { apiSend } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [next, setNext] = useState("/dienstplan");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(params.get("next") ?? "/dienstplan");
    fetch("/api/auth")
      .then((r) => r.json())
      .then((json) => {
        if (json.authenticated) {
          router.replace(next);
        } else if (json.needsSetup) {
          router.replace("/setup");
        }
      })
      .finally(() => setLoading(false));
  }, [router, next]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiSend("/api/auth", "POST", {
        action: "login",
        username,
        password,
      });
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-[var(--muted)]">
        Wird geladen…
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          Schichtwerk
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Melden Sie sich mit Ihrem Administrator-Konto an.
        </p>
      </div>

      <Panel>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Benutzername"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
          <Input
            label="Passwort"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {error ? (
            <p className="text-sm text-[var(--danger)]">{error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Anmelden…" : "Anmelden"}
          </Button>
        </form>
      </Panel>

      <p className="mt-4 text-center text-xs text-[var(--muted)]">
        Erstinstallation?{" "}
        <Link href="/setup" className="text-[var(--accent)] underline">
          Setup starten
        </Link>
      </p>
    </div>
  );
}
