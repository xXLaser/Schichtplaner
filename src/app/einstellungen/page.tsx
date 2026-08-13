"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader, Panel, Button, Input, Select } from "@/components/ui";
import { apiSend } from "@/lib/api";

type AppSettings = {
  databaseMode: "local" | "mysql";
  mysqlUrl: string | null;
  webAccess: "local" | "network";
  federalState: string;
  effectiveDatabase: string;
  hostname: string | null;
};

export default function EinstellungenPage() {
  const [config, setConfig] = useState<AppSettings | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setMessage("Einstellungen konnten nicht geladen werden."));
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!config) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await apiSend<AppSettings & { message?: string }>(
        "/api/settings",
        "POST",
        {
          databaseMode: config.databaseMode,
          mysqlUrl: config.mysqlUrl,
          webAccess: config.webAccess,
          federalState: config.federalState,
          newPassword: newPassword || undefined,
        },
      );
      setConfig(result);
      setNewPassword("");
      setMessage(result.message ?? "Gespeichert.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  if (!config) {
    return <p className="text-sm text-[var(--muted)]">Laden…</p>;
  }

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        title="Einstellungen"
        subtitle="Datenbank, Netzwerkzugriff und Administrator-Passwort."
      />

      {message ? (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      <Panel>
        <form onSubmit={handleSave} className="mx-auto max-w-xl space-y-5">
          <Select
            label="Datenbank"
            value={config.databaseMode}
            onChange={(e) =>
              setConfig({
                ...config,
                databaseMode: e.target.value as "local" | "mysql",
              })
            }
          >
            <option value="local">Lokal (SQLite, Standard für EXE)</option>
            <option value="mysql">Externe MySQL-Datenbank</option>
          </Select>

          {config.databaseMode === "mysql" ? (
            <Input
              label="MySQL-Verbindungs-URL"
              value={config.mysqlUrl ?? ""}
              onChange={(e) =>
                setConfig({ ...config, mysqlUrl: e.target.value })
              }
              placeholder="mysql://user:pass@host:3306/schichtwerk"
            />
          ) : (
            <p className="text-xs text-[var(--muted)]">
              Die lokale Datenbank wird automatisch im Benutzerordner gespeichert
              (EXE) bzw. unter prisma/dev.db (Entwicklung).
            </p>
          )}

          <Select
            label="Netzwerkzugriff"
            value={config.webAccess}
            onChange={(e) =>
              setConfig({
                ...config,
                webAccess: e.target.value as "local" | "network",
              })
            }
          >
            <option value="local">Nur lokal (127.0.0.1) – empfohlen</option>
            <option value="network">Im Netzwerk erreichbar (0.0.0.0)</option>
          </Select>

          <p className="text-xs text-[var(--muted)]">
            Aktuell aktiv: {config.effectiveDatabase}
            {config.hostname ? ` · Host: ${config.hostname}` : ""}. Änderungen
            an Datenbank und Netzwerk erfordern einen Neustart.
          </p>

          <Input
            label="Neues Administrator-Passwort (optional)"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mindestens 8 Zeichen"
          />

          <Button type="submit" disabled={busy}>
            {busy ? "Speichern…" : "Einstellungen speichern"}
          </Button>
        </form>
      </Panel>

      <Panel>
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-lg">
          Dienstplan-Import/-Export
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Export und Import finden Sie direkt auf der Seite{" "}
          <a href="/dienstplan" className="text-[var(--accent)] underline">
            Dienstplan
          </a>{" "}
          und im Setup-Assistenten.
        </p>
      </Panel>
    </div>
  );
}
