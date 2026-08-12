"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { PageHeader, Panel, Button, EmptyState } from "@/components/ui";
import { ApiError, apiSend } from "@/lib/api";
import { toISODate, weekStart, formatDateRange } from "@/lib/dates";

type Shift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  kind: string;
};
type Employee = {
  id: string;
  name: string;
  dutyModel?: string;
  employmentType?: string;
};
type Entry = {
  id: string;
  date: string;
  shiftTemplateId: string;
  employeeId: string;
  employee: Employee;
  shiftTemplate: Shift;
  note?: string | null;
};

type SetupMeta = {
  startDate: string;
  endDate: string;
  dayCount: number;
};

type BaseData = {
  days: string[];
  shifts: Shift[];
  employees: Employee[];
  entries: Entry[];
  minRestHours: number;
  setup: SetupMeta;
};

export default function UrsprungPage() {
  const [setupStart, setSetupStart] = useState(() => toISODate(weekStart()));
  const [data, setData] = useState<BaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [pickEmp, setPickEmp] = useState("");
  const [pickShift, setPickShift] = useState("");

  const end = useMemo(
    () => toISODate(addDays(new Date(setupStart + "T00:00:00"), 13)),
    [setupStart],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/base-schedule?from=${setupStart}&to=${end}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Fehler ${res.status}`);
      setData(json);
      if (json.setup?.startDate && json.setup.startDate !== setupStart) {
        setSetupStart(json.setup.startDate);
      }
      setPickShift((prev) => prev || json.shifts?.[0]?.id || "");
    } catch (err) {
      setData(null);
      setMessage(err instanceof Error ? err.message : "Laden fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }, [setupStart, end]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSetupStart(nextStart: string) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await apiSend<{ setup: SetupMeta }>("/api/base-schedule", "POST", {
        action: "setup",
        startDate: nextStart,
      });
      setSetupStart(result.setup.startDate);
      setMessage(
        `Setup-Fenster gesetzt: ${formatDateRange(result.setup.startDate, result.setup.dayCount)}`,
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Setup speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function importFromSchedule() {
    if (
      !confirm(
        `Zuweisungen aus dem Dienstplan für ${formatDateRange(setupStart, 14)} in den Ursprungsplan übernehmen? Bestehende Setup-Einträge in diesem Fenster werden ersetzt.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await apiSend<{ imported: number; setup: SetupMeta }>(
        "/api/base-schedule",
        "POST",
        { action: "import", startDate: setupStart },
      );
      setSetupStart(result.setup.startDate);
      setMessage(
        `${result.imported} Einträge aus dem Dienstplan übernommen (${formatDateRange(result.setup.startDate, result.setup.dayCount)}).`,
      );
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Übernahme fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function applyToDutyModels() {
    if (
      !confirm(
        "Aus dem Setup Zyklusstart und Schichtpräferenz für alle Vollzeit-Mitarbeiter ableiten und speichern? Danach läuft die Rotation über die Dienstmodelle.",
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await apiSend<{
        updated: number;
        skippedWeekdays: number;
        skippedNoShifts: number;
        warnings: string[];
        setup: SetupMeta;
      }>("/api/base-schedule", "POST", {
        action: "apply",
        startDate: setupStart,
      });
      const warn =
        result.warnings?.length > 0
          ? ` · Hinweise: ${result.warnings.slice(0, 3).join(" | ")}`
          : "";
      setMessage(
        `${result.updated} Mitarbeiter aktualisiert` +
          (result.skippedWeekdays
            ? `, ${result.skippedWeekdays} Teilzeit/Mo–Fr übersprungen`
            : "") +
          (result.skippedNoShifts
            ? `, ${result.skippedNoShifts} ohne Setup-Dienste`
            : "") +
          warn,
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ableitung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function suggestFromModels() {
    if (
      !confirm(
        "Optional: Setup aus aktuellen Dienstmodellen vorschlagen? Bestehende Einträge der 14 Tage werden ersetzt.",
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await apiSend("/api/base-schedule", "POST", {
        action: "setup",
        startDate: setupStart,
      });
      const result = await apiSend<{ created: number }>(
        "/api/base-schedule",
        "POST",
        {
          action: "suggest",
          startDate: setupStart,
          endDate: end,
          replaceExisting: true,
        },
      );
      setMessage(`${result.created} Einträge aus Dienstmodellen vorgeschlagen.`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Vorschlag fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function addEntry(day: string) {
    if (!pickEmp || !pickShift) {
      setMessage("Bitte Mitarbeiter und Schicht wählen.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await apiSend("/api/base-schedule", "POST", {
        date: day,
        employeeId: pickEmp,
        shiftTemplateId: pickShift,
      });
      setAdding(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const force = confirm(
          `${err.message}\n\nTrotzdem eintragen? (Ruhezeit-Prüfung überspringen)`,
        );
        if (force) {
          try {
            await apiSend("/api/base-schedule", "POST", {
              date: day,
              employeeId: pickEmp,
              shiftTemplateId: pickShift,
              force: true,
            });
            setAdding(null);
            await load();
            return;
          } catch (e2) {
            setMessage(e2 instanceof Error ? e2.message : "Fehler");
          }
        } else {
          setMessage(err.message);
        }
      } else {
        setMessage(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
      }
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(id: string) {
    setBusy(true);
    try {
      await apiSend(`/api/base-schedule/${id}`, "DELETE");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  function entriesFor(day: string, shiftId?: string) {
    return (
      data?.entries.filter(
        (e) => e.date === day && (!shiftId || e.shiftTemplateId === shiftId),
      ) ?? []
    );
  }

  const week1Days = data?.days.slice(0, 7) ?? [];
  const week2Days = data?.days.slice(7, 14) ?? [];

  function renderWeekTable(days: string[], label: string) {
    if (!data || days.length === 0) return null;
    return (
      <Panel className="overflow-x-auto">
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">
          {label}
        </h2>
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-[var(--line)] p-2 text-left font-medium text-[var(--muted)]">
                Schicht
              </th>
              {days.map((d) => (
                <th
                  key={d}
                  className="border-b border-[var(--line)] p-2 text-left font-medium"
                >
                  {format(parseISO(d), "EEE dd.MM.", { locale: de })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.shifts.map((shift) => (
              <tr key={shift.id}>
                <td className="border-b border-[var(--line)] p-2 align-top">
                  <div className="font-medium">{shift.name}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {shift.startTime}–{shift.endTime}
                  </div>
                </td>
                {days.map((day) => {
                  const list = entriesFor(day, shift.id);
                  const cellKey = `${day}|${shift.id}`;
                  return (
                    <td
                      key={cellKey}
                      className="border-b border-[var(--line)] p-2 align-top"
                    >
                      <div className="space-y-1">
                        {list.map((e) => (
                          <div
                            key={e.id}
                            className="flex items-center justify-between gap-1 rounded-md px-2 py-1 text-xs text-white"
                            style={{ backgroundColor: shift.color }}
                          >
                            <span className="truncate">{e.employee.name}</span>
                            <button
                              type="button"
                              className="opacity-80 hover:opacity-100"
                              onClick={() => void removeEntry(e.id)}
                              aria-label="Entfernen"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {adding === cellKey ? (
                          <div className="space-y-1">
                            <select
                              className="w-full rounded border border-[var(--line)] bg-white px-1 py-1 text-xs"
                              value={pickEmp}
                              onChange={(e) => setPickEmp(e.target.value)}
                            >
                              <option value="">Mitarbeiter…</option>
                              {data.employees.map((emp) => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.name}
                                </option>
                              ))}
                            </select>
                            <div className="flex gap-1">
                              <Button
                                className="!px-2 !py-1 text-xs"
                                disabled={busy}
                                onClick={() => void addEntry(day)}
                              >
                                OK
                              </Button>
                              <Button
                                variant="ghost"
                                className="!px-2 !py-1 text-xs"
                                onClick={() => setAdding(null)}
                              >
                                Abbruch
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="text-xs text-[var(--accent)] hover:underline"
                            onClick={() => {
                              setPickShift(shift.id);
                              setAdding(cellKey);
                            }}
                          >
                            + Person
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    );
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Ursprungsplan · Setup"
        subtitle="Diese 2 Wochen sind der Startpunkt. Tragen Sie den Plan manuell ein oder übernehmen Sie ihn aus dem Dienstplan. Anschließend werden Zyklusstart und Schichtpräferenz für die 4/4-Rotation abgeleitet."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void saveSetupStart(
                  toISODate(addDays(new Date(setupStart + "T00:00:00"), -14)),
                )
              }
            >
              ← 2 Wochen
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void saveSetupStart(toISODate(weekStart()))}
            >
              Ab dieser Woche
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void saveSetupStart(
                  toISODate(addDays(new Date(setupStart + "T00:00:00"), 14)),
                )
              }
            >
              2 Wochen →
            </Button>
            <Button onClick={() => void importFromSchedule()} disabled={busy}>
              Aus Dienstplan übernehmen
            </Button>
            <Button onClick={() => void applyToDutyModels()} disabled={busy}>
              Setup auf Dienstmodelle anwenden
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm text-[var(--muted)]">
          Setup-Start
          <input
            type="date"
            className="mt-1 block rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-[var(--ink)]"
            value={setupStart}
            onChange={(e) => setSetupStart(e.target.value)}
            onBlur={(e) => {
              if (e.target.value) void saveSetupStart(e.target.value);
            }}
          />
        </label>
        <p className="pb-1.5 text-sm text-[var(--muted)]">
          {formatDateRange(setupStart, 14)}
          {data?.minRestHours
            ? ` · Mindestruhezeit ${data.minRestHours} Stunden`
            : ""}
          {data ? ` · ${data.entries.length} Einträge` : ""}
        </p>
      </div>

      {message ? (
        <div className="mb-4 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      {loading || !data ? (
        <EmptyState text={loading ? "Lade Setup…" : "Keine Daten."} />
      ) : (
        <div className="space-y-4">
          {renderWeekTable(week1Days, "Woche 1")}
          {renderWeekTable(week2Days, "Woche 2")}

          <Panel>
            <h2 className="mb-2 font-[family-name:var(--font-display)] text-lg">
              Ablauf
            </h2>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--ink-soft)]">
              <li>Setup-Start auf den Beginn Ihrer manuellen 2 Wochen setzen.</li>
              <li>
                Plan hier eintragen oder „Aus Dienstplan übernehmen“ nutzen.
              </li>
              <li>
                „Setup auf Dienstmodelle anwenden“ – setzt Zyklusstart und
                Tag/Nacht-Präferenz je Mitarbeiter.
              </li>
              <li>
                Unter „Dienstplan“ künftige Wochen generieren – die Rotation läuft
                über das 4/4-Modell weiter, Lücken werden automatisch gefüllt.
              </li>
            </ol>
            <div className="mt-4">
              <Button
                variant="ghost"
                className="text-xs"
                disabled={busy}
                onClick={() => void suggestFromModels()}
              >
                Optional: aus aktuellen Modellen vorschlagen
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
