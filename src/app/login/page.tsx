"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Panel } from "@/components/ui";
import { apiSend } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiSend("/api/auth/login", "POST", { username, password });
      router.replace("/dienstplan");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md animate-fade-up py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
        Schichtwerk
      </h1>
      <p className="mt-2 mb-6 text-sm text-[var(--muted)]">
        Bitte mit dem Administratorkonto anmelden.
      </p>
      <Panel>
        <form onSubmit={onSubmit} className="space-y-3">
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
          <Button type="submit" disabled={busy}>
            {busy ? "Anmelden…" : "Anmelden"}
          </Button>
        </form>
      </Panel>
    </div>
  );
}
