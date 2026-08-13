"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addMonths, addQuarters, format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import {
  PageHeader,
  Panel,
  Button,
  EmptyState,
  ErrorBanner,
} from "@/components/ui";
import { apiGet } from "@/lib/api";
import { toISODate } from "@/lib/dates";

type Entry = {
  employeeId: string;
  name: string;
  hoursPeriod: "MONTH" | "QUARTER";
  periodLabel: string;
  targetHours: number | null;
  workedHours: number;
  remainingHours: number | null;
  shiftPreference: "ANY" | "DAY_ONLY" | "NIGHT_ONLY" | "ROTATING";
};

const PREFERENCE_LABELS: Record<Entry["shiftPreference"], string> = {
  ANY: "Egal",
  DAY_ONLY: "Nur Tag",
  NIGHT_ONLY: "Nur Nacht",
  ROTATING: "Wechseldienst",
};

export default function StundenPage() {
  const [reference, setReference] = useState(() => toISODate(new Date()));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await apiGet<{ entries: Entry[] }>(
        `/api/hours-report?date=${reference}`,
      );
      setEntries(json.entries ?? []);
    } catch (err) {
      setEntries([]);
      setError(err instanceof Error ? err.message : "Laden fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }, [reference]);

  useEffect(() => {
    void load();
  }, [load]);

  const refDate = useMemo(() => parseISO(reference), [reference]);

  const withTarget = entries.filter((e) => e.targetHours != null);
  const withoutTarget = entries.filter((e) => e.targetHours == null);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Stunden-Übersicht"
        subtitle="Vergleich von Soll- und Ist-Stunden je Mitarbeiter für Monat oder Quartal – abhängig von der jeweiligen Einstellung."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                setReference(toISODate(addMonths(refDate, -1)))
              }
            >
              ← Monat
            </Button>
            <Button
              variant="secondary"
              onClick={() => setReference(toISODate(new Date()))}
            >
              Heute
            </Button>
            <Button
              variant="secondary"
              onClick={() => setReference(toISODate(addMonths(refDate, 1)))}
            >
              Monat →
            </Button>
            <Button
              variant="secondary"
              onClick={() => setReference(toISODate(addQuarters(refDate, -1)))}
            >
              ← Quartal
            </Button>
            <Button
              variant="secondary"
              onClick={() => setReference(toISODate(addQuarters(refDate, 1)))}
            >
              Quartal →
            </Button>
          </>
        }
      />

      <p className="mb-6 text-sm text-[var(--muted)]">
        Referenzdatum:{" "}
        <span className="font-medium text-[var(--ink)]">
          {format(refDate, "dd.MM.yyyy", { locale: de })}
        </span>{" "}
        – jede Person wird nach ihrem eigenen Zeitraum (Monat/Quartal) bewertet.
      </p>

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      {loading ? (
        <EmptyState text="Stunden werden berechnet…" />
      ) : entries.length === 0 ? (
        <EmptyState text="Keine aktiven Mitarbeiter gefunden." />
      ) : (
        <div className="space-y-6">
          <Panel>
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-lg">
              Mit Stunden-Ziel
            </h2>
            {withTarget.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Noch niemand hat ein Stunden-Ziel hinterlegt (siehe Mitarbeiter-Seite).
              </p>
            ) : (
              <div className="space-y-4">
                {withTarget.map((e) => {
                  const target = e.targetHours ?? 0;
                  const pct = target > 0 ? Math.min(150, (e.workedHours / target) * 100) : 0;
                  const over = e.workedHours > target;
                  return (
                    <div key={e.employeeId}>
                      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium">
                          {e.name}{" "}
                          <span className="text-xs text-[var(--muted)]">
                            ({PREFERENCE_LABELS[e.shiftPreference]})
                          </span>
                        </span>
                        <span className="text-[var(--muted)]">
                          {e.workedHours.toFixed(1)} / {target.toFixed(0)} Std. ·{" "}
                          {e.periodLabel}
                          {e.remainingHours != null ? (
                            <>
                              {" "}
                              ·{" "}
                              <span
                                className={
                                  e.remainingHours < 0
                                    ? "text-[var(--danger)]"
                                    : "text-[var(--ink-soft)]"
                                }
                              >
                                {e.remainingHours >= 0
                                  ? `${e.remainingHours.toFixed(1)} Std. offen`
                                  : `${Math.abs(e.remainingHours).toFixed(1)} Std. über Soll`}
                              </span>
                            </>
                          ) : null}
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                        <div
                          className={`h-full rounded-full transition-all ${
                            over ? "bg-[var(--warn)]" : "bg-[var(--accent)]"
                          }`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {withoutTarget.length > 0 ? (
            <Panel>
              <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">
                Ohne Stunden-Ziel (nach Schichtanzahl geplant)
              </h2>
              <ul className="space-y-1.5 text-sm text-[var(--ink-soft)]">
                {withoutTarget.map((e) => (
                  <li key={e.employeeId} className="flex justify-between">
                    <span>
                      {e.name}{" "}
                      <span className="text-xs text-[var(--muted)]">
                        ({PREFERENCE_LABELS[e.shiftPreference]})
                      </span>
                    </span>
                    <span className="text-[var(--muted)]">
                      {e.workedHours.toFixed(1)} Std. ({e.periodLabel})
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      )}
    </div>
  );
}
