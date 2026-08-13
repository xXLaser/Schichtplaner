"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader, Panel, Button, Select, Input, EmptyState } from "@/components/ui";
import { apiGet, apiSend } from "@/lib/api";

type Settings = {
  databaseProvider: "sqlite" | "mysql";
  webAccess: boolean;
  host: string;
  port: number;
  holidayRegion: "AT" | "DE";
  planningDays: number;
  restartHint?: string;
};

export default function EinstellungenPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [webAccess, setWebAccess] = useState(false);
  const [holidayRegion, setHolidayRegion] = useState<"AT" | "DE">("AT");
  const [planningDays, setPlanningDays] = useState(14);
  const [provider, setProvider] = useState<"sqlite" | "mysql">("sqlite");
  const [mysqlUrl, setMysqlUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiGet<Settings>("/api/settings")
      .then((s) => {
        setSettings(s);
        setWebAccess(s.webAccess);
        setHolidayRegion(s.holidayRegion);
        setPlanningDays(s.planningDays);
        setProvider(s.databaseProvider);
      })
      .catch((err) =>
        setMessage(err instanceof Error ? err.message : "Laden fehlgeschlagen"),
      );
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const saved = await apiSend<Settings>("/api/settings", "POST", {
        webAccess,
        holidayRegion,
        planningDays,
        databaseProvider: provider,
        mysqlUrl: provider === "mysql" ? mysqlUrl : undefined,
      });
      setSettings(saved);
      setMessage(
        "Gespeichert. " +
          (saved.restartHint ?? "Webzugriff und Datenbank brauchen einen Neustart."),
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  if (!settings) {
    return <EmptyState text="Einstellungen werden geladen…" />;
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Einstellungen"
        subtitle="Lokale SQLite-Datenbank oder externes MySQL, Webzugriff im LAN, Feiertage und Planungshorizont."
      />
      {message ? (
        <Panel className="mb-6">
          <p className="text-sm">{message}</p>
        </Panel>
      ) : null}
      <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">
            Datenbank
          </h2>
          <Select
            label="Speicherort"
            value={provider}
            onChange={(e) => setProvider(e.target.value as "sqlite" | "mysql")}
          >
            <option value="sqlite">Onboard (SQLite, Datei auf diesem PC)</option>
            <option value="mysql">Externes MySQL</option>
          </Select>
          {provider === "mysql" ? (
            <div className="mt-3">
              <Input
                label="MySQL-Verbindung"
                value={mysqlUrl}
                onChange={(e) => setMysqlUrl(e.target.value)}
                placeholder="mysql://user:pass@host:3306/schichtwerk"
              />
              <p className="mt-2 text-xs text-[var(--muted)]">
                Nach dem Speichern die Anwendung neu starten, damit Prisma MySQL
                verwendet.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">
              Die lokale Datenbank liegt neben der Anwendung (in der EXE unter
              AppData). Kein Server nötig.
            </p>
          )}
        </Panel>
        <Panel>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">
            Zugriff &amp; Planung
          </h2>
          <label className="mb-3 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={webAccess}
              onChange={(e) => setWebAccess(e.target.checked)}
            />
            <span>
              Webzugriff im lokalen Netz erlauben (sonst nur auf diesem Computer).
              Port {settings.port}. Neustart nötig.
            </span>
          </label>
          <Select
            label="Feiertage"
            value={holidayRegion}
            onChange={(e) => setHolidayRegion(e.target.value as "AT" | "DE")}
          >
            <option value="AT">Österreich</option>
            <option value="DE">Deutschland (bundesweit)</option>
          </Select>
          <div className="mt-3">
            <Input
              label="Planungshorizont (Tage)"
              type="number"
              min={7}
              max={28}
              value={planningDays}
              onChange={(e) => setPlanningDays(Number(e.target.value))}
            />
            <p className="mt-2 text-xs text-[var(--muted)]">
              Standard sind 14 Tage – immer die nächsten zwei Wochen planen,
              Urlaube werden berücksichtigt.
            </p>
          </div>
        </Panel>
        <div>
          <Button type="submit" disabled={busy}>
            Speichern
          </Button>
        </div>
      </form>
    </div>
  );
}
