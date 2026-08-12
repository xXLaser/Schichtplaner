"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { PageHeader, Panel, Button, EmptyState } from "@/components/ui";
import { ApiError, apiSend } from "@/lib/api";
import { toISODate, weekStart, formatWeekRange } from "@/lib/dates";

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

type BaseData = {
  days: string[];
  shifts: Shift[];
  employees: Employee[];
  entries: Entry[];
  minRestHours: number;
};

export default function UrsprungPage() {
  const [week, setWeek] = useState(() => toISODate(weekStart()));
  const [data, setData] = useState<BaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [pickEmp, setPickEmp] = useState("");
  const [pickShift, setPickShift] = useState("");

  const end = useMemo(
    () => toISODate(addDays(new Date(week + "T00:00:00"), 6)),
    [week],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/base-schedule?from=${week}&to=${end}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Fehler ${res.status}`);
      setData(json);
      setPickShift((prev) => prev || json.shifts?.[0]?.id || "");
    } catch (err) {
      setData(null);
      setMessage(err instanceof Error ? err.message : "Laden fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }, [week, end]);

  useEffect(() => {
    void load();
  }, [load]);

  async function suggestFromModels() {
    if (
      !confirm(
        "Ursprungsplan für diese Woche aus den Dienstmodellen neu vorschlagen? Bestehende Einträge der Woche werden ersetzt.",
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await apiSend<{ created: number }>(
        "/api/base-schedule",
        "POST",
        {
          action: "suggest",
          startDate: week,
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

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Ursprungsdienstplan"
        subtitle="Manuell pflegen oder aus Dienstmodellen vorschlagen. Der Dienstplan-Generator nutzt diesen Plan immer als Basis (Abwesenheiten, Ruhezeit 12 Std. und Modelle werden dabei geprüft)."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                setWeek(toISODate(addDays(new Date(week + "T00:00:00"), -7)))
              }
            >
              ← Woche
            </Button>
            <Button
              variant="secondary"
              onClick={() => setWeek(toISODate(weekStart()))}
            >
              Heute
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                setWeek(toISODate(addDays(new Date(week + "T00:00:00"), 7)))
              }
            >
              Woche →
            </Button>
            <Button onClick={() => void suggestFromModels()} disabled={busy}>
              Aus Modellen vorschlagen
            </Button>
          </div>
        }
      />

      <p className="mb-4 text-sm text-[var(--muted)]">
        {formatWeekRange(week)}
        {data?.minRestHours
          ? ` · Mindestruhezeit ${data.minRestHours} Stunden zwischen Diensten`
          : ""}
      </p>

      {message ? (
        <div className="mb-4 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      {loading || !data ? (
        <EmptyState text={loading ? "Lade Ursprungsplan…" : "Keine Daten."} />
      ) : (
        <div className="space-y-4">
          <Panel className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-[var(--line)] p-2 text-left font-medium text-[var(--muted)]">
                    Schicht
                  </th>
                  {data.days.map((d) => (
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
                    {data.days.map((day) => {
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

          <Panel>
            <h2 className="mb-2 font-[family-name:var(--font-display)] text-lg">
              Hinweis zum Ablauf
            </h2>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--ink-soft)]">
              <li>Bei jedem Mitarbeiter das Dienstmodell hinterlegen (4/4 oder Mo–Fr).</li>
              <li>
                Hier den Ursprungsplan manuell eintragen oder „Aus Modellen
                vorschlagen“ nutzen.
              </li>
              <li>
                Unter „Dienstplan“ generieren – der Ursprung wird übernommen,
                Lücken gefüllt, Abwesenheiten und 12-Stunden-Ruhezeit beachtet.
              </li>
            </ol>
          </Panel>
        </div>
      )}
    </div>
  );
}
