"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PageHeader, Panel, Button, Input, Select, EmptyState } from "@/components/ui";
import { apiSend } from "@/lib/api";

type Settings = {
  dbMode: "sqlite" | "mysql";
  mysqlUrl: string;
  mysqlUrlMasked?: string;
  webAccess: boolean;
  port: number;
  holidayRegion: "AT" | "DE" | "DE-BY" | "NONE";
  companyName: string;
  restartHint?: string;
};

export default function EinstellungenPage() {
  const [cfg, setCfg] = useState<Settings | null>(null);
  const [mysqlUrl, setMysqlUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Laden fehlgeschlagen");
    setCfg(json);
    setMysqlUrl("");
  }, []);

  useEffect(() => {
    void load().catch((e) =>
      setMessage(e instanceof Error ? e.message : "Fehler"),
    );
  }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!cfg) return;
    setBusy(true);
    setMessage(null);
    try {
      const body: Record<string, unknown> = {
        dbMode: cfg.dbMode,
        webAccess: cfg.webAccess,
        port: cfg.port,
        holidayRegion: cfg.holidayRegion,
        companyName: cfg.companyName,
      };
      if (mysqlUrl.trim()) body.mysqlUrl = mysqlUrl.trim();
      const res = await apiSend<{ restartRequired?: boolean }>("/api/settings", "POST", body);
      await load();
      setMessage(
        res.restartRequired
          ? "Gespeichert. Bitte App neu starten, damit DB-/Netzwerk-Änderungen greifen."
          : "Gespeichert.",
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  if (!cfg) {
    return <EmptyState text="Einstellungen werden geladen…" />;
  }

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        title="Einstellungen"
        subtitle="Datenbank, Web-Zugriff und Feiertage – für den lokalen 2-Wochen-Betrieb."
      />

      {message ? (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      <form onSubmit={save} className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">
            Datenbank
          </h2>
          <div className="space-y-3">
            <Select
              label="Modus"
              value={cfg.dbMode}
              onChange={(e) =>
                setCfg({ ...cfg, dbMode: e.target.value as "sqlite" | "mysql" })
              }
            >
              <option value="sqlite">Onboard (SQLite, Datei lokal)</option>
              <option value="mysql">Externe MySQL</option>
            </Select>
            {cfg.dbMode === "mysql" ? (
              <>
                <Input
                  label="MySQL-URL"
                  placeholder="mysql://user:pass@host:3306/schichtwerk"
                  value={mysqlUrl}
                  onChange={(e) => setMysqlUrl(e.target.value)}
                />
                {cfg.mysqlUrlMasked ? (
                  <p className="text-xs text-[var(--muted)]">
                    Aktuell: {cfg.mysqlUrlMasked}
                  </p>
                ) : null}
                <p className="text-xs text-[var(--muted)]">
                  MySQL erfordert einen Build mit MySQL-Schema (
                  <code>npm run db:use-mysql</code>) und Neustart. Die portable EXE
                  nutzt standardmäßig SQLite.
                </p>
              </>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Daten liegen lokal in einer SQLite-Datei (Desktop: unter
                AppData). Ideal für Einzelplatz.
              </p>
            )}
          </div>
        </Panel>

        <Panel>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">
            Zugriff & Feiertage
          </h2>
          <div className="space-y-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={cfg.webAccess}
                onChange={(e) => setCfg({ ...cfg, webAccess: e.target.checked })}
              />
              <span>
                <strong>Web-Zugriff im LAN</strong>
                <br />
                <span className="text-[var(--muted)]">
                  Aus = nur dieser PC (localhost). An = erreichbar im Netzwerk
                  (0.0.0.0).
                </span>
              </span>
            </label>
            <Input
              label="Port"
              type="number"
              value={String(cfg.port)}
              onChange={(e) =>
                setCfg({ ...cfg, port: Number(e.target.value) || 3847 })
              }
            />
            <Select
              label="Feiertagsregion"
              value={cfg.holidayRegion}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  holidayRegion: e.target.value as Settings["holidayRegion"],
                })
              }
            >
              <option value="AT">Österreich</option>
              <option value="DE">Deutschland (bundesweit)</option>
              <option value="DE-BY">Deutschland – Bayern</option>
              <option value="NONE">Keine Feiertage</option>
            </Select>
            <Input
              label="Firmenname (optional)"
              value={cfg.companyName}
              onChange={(e) => setCfg({ ...cfg, companyName: e.target.value })}
            />
          </div>
        </Panel>

        <div className="lg:col-span-2 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy}>
            Speichern
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void fetch("/api/auth/logout", { method: "POST" }).then(() => {
                window.location.href = "/login";
              });
            }}
          >
            Abmelden
          </Button>
          <p className="w-full text-xs text-[var(--muted)]">{cfg.restartHint}</p>
        </div>
      </form>
    </div>
  );
}
