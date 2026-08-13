"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel, Button, Input } from "@/components/ui";
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center animate-fade-up">
      <Panel className="w-full">
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Schichtwerk
        </h1>
        <p className="mt-1 mb-5 text-sm text-[var(--muted)]">
          Mit Admin-Konto anmelden
        </p>
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
          <Button type="submit" disabled={busy} className="w-full">
            Anmelden
          </Button>
        </form>
      </Panel>
    </div>
  );
}
