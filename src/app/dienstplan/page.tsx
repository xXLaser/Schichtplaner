"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays } from "date-fns";
import { PageHeader, Panel, Button, Badge, EmptyState } from "@/components/ui";
import { apiSend, ApiError } from "@/lib/api";
import {
  ABSENCE_LABELS,
  formatDayLabel,
  formatWeekRange,
  toISODate,
  weekStart,
} from "@/lib/dates";

type Competency = { id: string; name: string; color: string };
type Shift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  kind: "DAY" | "NIGHT";
  requirements: { competencyId: string; minCount: number; competency: Competency }[];
};
type Assignment = {
  id: string;
  date: string;
  shiftTemplateId: string;
  employeeId: string;
  competencyId: string | null;
  employee: {
    id: string;
    name: string;
    competencies: { competency: Competency }[];
  };
  shiftTemplate: Shift;
};
type Absence = {
  id: string;
  type: string;
  status?: string;
  startDate: string;
  endDate: string;
  employee: { id: string; name: string };
};
type Warning = {
  date: string;
  shiftName: string;
  competencyName: string;
  required: number;
  assigned: number;
};
type EmployeeOption = {
  id: string;
  name: string;
  competencies: { competency: Competency }[];
};

type Holiday = { date: string; name: string };

type ScheduleData = {
  days: string[];
  shifts: Shift[];
  assignments: Assignment[];
  absences: Absence[];
  competencies: Competency[];
  employees: EmployeeOption[];
  holidays?: Holiday[];
};

export default function DienstplanPage() {
  const [week, setWeek] = useState(() => toISODate(weekStart()));
  const [data, setData] = useState<ScheduleData | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mobileDay, setMobileDay] = useState(() => toISODate(new Date()));
  const [editMode, setEditMode] = useState(false);
  const [addingCell, setAddingCell] = useState<string | null>(null);
  const [pickEmployeeId, setPickEmployeeId] = useState("");
  const [busyCell, setBusyCell] = useState<string | null>(null);

  const end = useMemo(() => toISODate(addDays(new Date(week + "T00:00:00"), 6)), [week]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/schedule?from=${week}&to=${end}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? `Fehler ${res.status}`);
      }
      if (!json.days) {
        throw new Error(
          "Dienstplan-Antwort ungültig. Prüfen Sie /api/health auf dem Server.",
        );
      }
      setData(json);
      if (json.days?.length) {
        const today = toISODate(new Date());
        setMobileDay(json.days.includes(today) ? today : json.days[0]);
      }
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

  async function generate() {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: week,
          endDate: end,
          replaceExisting: true,
        }),
      });
      const result = await res.json();
      setWarnings(result.warnings ?? []);
      setMessage(
        `${result.created} Zuweisungen erstellt` +
          (result.fromBase
            ? ` (davon ${result.fromBase} aus Ursprungsplan)`
            : "") +
          (result.warnings?.length
            ? ` · ${result.warnings.length} Kompetenzlücken`
            : " · alle Anforderungen erfüllt"),
      );
      await load();
    } finally {
      setGenerating(false);
    }
  }

  function holidayName(day: string): string | null {
    return data?.holidays?.find((h) => h.date === day)?.name ?? null;
  }

  function exportPlan() {
    window.location.href = `/api/schedule/export?from=${week}&to=${end}&source=assignments`;
  }

  async function importPlanFile(file: File) {
    setMessage(null);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await apiSend<{
        created: number;
        skipped: number;
      }>("/api/schedule/import", "POST", {
        payload,
        target: "assignments",
        replaceRange: true,
        createMissing: true,
      });
      setMessage(`Import: ${res.created} Einträge` + (res.skipped ? `, ${res.skipped} übersprungen` : ""));
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Import fehlgeschlagen");
    }
  }

  function shiftPeople(day: string, shiftId: string) {
    return (
      data?.assignments.filter(
        (a) => a.date === day && a.shiftTemplateId === shiftId,
      ) ?? []
    );
  }

  function dayAbsences(day: string) {
    return (
      data?.absences.filter((a) => a.startDate <= day && a.endDate >= day) ?? []
    );
  }

  function cellKey(day: string, shiftId: string) {
    return `${day}__${shiftId}`;
  }

  function availableEmployees(day: string, shiftId: string) {
    const already = new Set(shiftPeople(day, shiftId).map((p) => p.employeeId));
    return (data?.employees ?? []).filter((e) => !already.has(e.id));
  }

  async function handleAdd(day: string, shiftId: string, force = false) {
    if (!pickEmployeeId) return;
    const key = cellKey(day, shiftId);
    setBusyCell(key);
    try {
      await apiSend("/api/assignments", "POST", {
        date: day,
        shiftTemplateId: shiftId,
        employeeId: pickEmployeeId,
        force,
      });
      setAddingCell(null);
      setPickEmployeeId("");
      await load();
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 409 &&
        ((err.body as { code?: string } | undefined)?.code === "ABSENT" ||
          (err.body as { code?: string } | undefined)?.code === "REST")
      ) {
        if (confirm(`${err.message}\n\nTrotzdem eintragen?`)) {
          await handleAdd(day, shiftId, true);
          return;
        }
      } else {
        alert(err instanceof Error ? err.message : "Hinzufügen fehlgeschlagen");
      }
    } finally {
      setBusyCell(null);
    }
  }

  async function handleRemove(assignmentId: string, cellKeyStr: string) {
    setBusyCell(cellKeyStr);
    try {
      await apiSend(`/api/assignments/${assignmentId}`, "DELETE");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Entfernen fehlgeschlagen");
    } finally {
      setBusyCell(null);
    }
  }

  function PersonCard({
    p,
    cellKeyStr,
    compact,
  }: {
    p: Assignment;
    cellKeyStr: string;
    compact?: boolean;
  }) {
    return (
      <li className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5">
        <div className="flex items-start justify-between gap-1">
          <div className="font-medium text-[var(--ink)]">{p.employee.name}</div>
          {editMode ? (
            <button
              type="button"
              title="Entfernen"
              disabled={busyCell === cellKeyStr}
              onClick={() => handleRemove(p.id, cellKeyStr)}
              className="shrink-0 rounded text-[var(--danger)] hover:bg-rose-50 px-1 text-xs font-bold leading-5 disabled:opacity-40"
            >
              ✕
            </button>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {p.employee.competencies.slice(0, compact ? 3 : undefined).map((c) => (
            <Badge key={c.competency.id} color={c.competency.color}>
              {c.competency.name}
            </Badge>
          ))}
        </div>
      </li>
    );
  }

  function AddControl({ day, shiftId }: { day: string; shiftId: string }) {
    const key = cellKey(day, shiftId);
    const options = availableEmployees(day, shiftId);
    if (addingCell !== key) {
      return (
        <button
          type="button"
          onClick={() => {
            setAddingCell(key);
            setPickEmployeeId("");
          }}
          className="mt-1 w-full rounded-md border border-dashed border-[var(--line)] py-1 text-xs text-[var(--accent)] hover:bg-[var(--surface-2)]"
        >
          + hinzufügen
        </button>
      );
    }
    return (
      <div className="mt-1 space-y-1 rounded-md border border-[var(--accent)]/40 bg-[var(--surface-2)]/60 p-1.5">
        <select
          className="w-full rounded border border-[var(--line)] bg-white px-1.5 py-1 text-xs"
          value={pickEmployeeId}
          onChange={(e) => setPickEmployeeId(e.target.value)}
        >
          <option value="">Person wählen…</option>
          {options.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={!pickEmployeeId || busyCell === key}
            onClick={() => handleAdd(day, shiftId)}
            className="flex-1 rounded bg-[var(--accent)] py-1 text-xs font-medium text-white disabled:opacity-40"
          >
            OK
          </button>
          <button
            type="button"
            onClick={() => setAddingCell(null)}
            className="flex-1 rounded bg-white py-1 text-xs text-[var(--ink-soft)] border border-[var(--line)]"
          >
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Dienstplan"
        subtitle="Basiert auf dem Ursprungsdienstplan; Abwesenheiten, Dienstmodelle und 12-Stunden-Ruhezeit werden automatisch beachtet."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                setWeek(toISODate(addDays(new Date(week + "T00:00:00"), -7)))
              }
            >
              ← Vorherige
            </Button>
            <Button
              variant="secondary"
              onClick={() => setWeek(toISODate(weekStart()))}
            >
              Diese Woche
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                setWeek(toISODate(addDays(new Date(week + "T00:00:00"), 7)))
              }
            >
              Nächste →
            </Button>
            <Button
              variant={editMode ? "primary" : "secondary"}
              onClick={() => {
                setEditMode((v) => !v);
                setAddingCell(null);
              }}
            >
              {editMode ? "Bearbeiten beenden" : "Nachträglich anpassen"}
            </Button>
            <Button onClick={generate} disabled={generating}>
              {generating ? "Plant…" : "Plan neu generieren"}
            </Button>
            <Button variant="secondary" onClick={exportPlan}>
              Export JSON
            </Button>
            <label className="inline-flex cursor-pointer items-center rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink-soft)] hover:bg-[var(--surface-2)]">
              Import JSON
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importPlanFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <p className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
          {formatWeekRange(week)}
        </p>
        {message ? (
          <span className="rounded-md bg-[var(--surface-2)] px-3 py-1 text-sm text-[var(--ink-soft)]">
            {message}
          </span>
        ) : null}
        {editMode ? (
          <span className="rounded-md bg-[var(--accent)]/10 px-3 py-1 text-sm text-[var(--accent-strong)]">
            Bearbeitungsmodus aktiv – Personen hinzufügen/entfernen möglich
          </span>
        ) : null}
      </div>

      {message && !data && !loading ? (
        <Panel className="mb-6 border-[var(--danger)]/30 bg-[#fff1f2]">
          <p className="text-sm font-semibold text-[var(--danger)]">
            Daten konnten nicht geladen werden
          </p>
          <p className="mt-1 text-sm">{message}</p>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Diagnose: <code>/api/health</code> im Browser öffnen
          </p>
        </Panel>
      ) : null}

      {warnings.length > 0 ? (
        <Panel className="mb-6 border-[var(--warn)]/40 bg-[#fff7ed]">
          <h2 className="mb-2 text-sm font-semibold text-[var(--warn)]">
            Kompetenzlücken nach Generierung
          </h2>
          <ul className="space-y-1 text-sm text-[var(--ink-soft)]">
            {warnings.map((w, i) => (
              <li key={`${w.date}-${w.shiftName}-${w.competencyName}-${i}`}>
                {formatDayLabel(w.date)} · {w.shiftName}: {w.competencyName}{" "}
                {w.assigned}/{w.required}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {loading || !data ? (
        <EmptyState text="Dienstplan wird geladen…" />
      ) : (
        <>
          {/* Mobile: Tag für Tag */}
          <div className="space-y-4 lg:hidden">
            <div className="flex gap-1 overflow-x-auto pb-1">
              {data.days.map((d) => {
                const hol = holidayName(d);
                return (
                  <button
                    key={d}
                    type="button"
                    title={hol ?? undefined}
                    onClick={() => setMobileDay(d)}
                    className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${
                      mobileDay === d
                        ? "bg-[var(--accent)] text-white"
                        : hol
                          ? "border border-[#f59e0b] bg-[#fffbeb] text-[var(--warn)]"
                          : "bg-[var(--surface)] border border-[var(--line)] text-[var(--ink-soft)]"
                    }`}
                  >
                    {formatDayLabel(d)}
                    {hol ? <span className="mt-0.5 block text-[9px] opacity-80">Feiertag</span> : null}
                  </button>
                );
              })}
            </div>
            {holidayName(mobileDay) ? (
              <p className="rounded-md border border-[#f59e0b]/50 bg-[#fffbeb] px-3 py-2 text-sm text-[var(--warn)]">
                Feiertag: {holidayName(mobileDay)}
              </p>
            ) : null}

            {data.shifts.map((shift) => {
              const people = shiftPeople(mobileDay, shift.id);
              const key = cellKey(mobileDay, shift.id);
              return (
                <Panel key={shift.id}>
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: shift.color }}
                    />
                    <div>
                      <div className="font-semibold">
                        {shift.name}{" "}
                        <span className="text-xs font-normal text-[var(--muted)]">
                          ({shift.kind === "NIGHT" ? "Nacht" : "Tag"})
                        </span>
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {shift.startTime}–{shift.endTime}
                      </div>
                    </div>
                  </div>
                  {people.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">Niemand eingeteilt</p>
                  ) : (
                    <ul className="space-y-2">
                      {people.map((p) => (
                        <PersonCard key={p.id} p={p} cellKeyStr={key} />
                      ))}
                    </ul>
                  )}
                  {editMode ? <AddControl day={mobileDay} shiftId={shift.id} /> : null}
                </Panel>
              );
            })}

            <Panel className="border-rose-200 bg-[#fff1f2]/70">
              <h3 className="mb-2 font-semibold text-[var(--danger)]">Abwesend</h3>
              {dayAbsences(mobileDay).length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Keine Abwesenheiten</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {dayAbsences(mobileDay).map((a) => (
                    <li key={a.id}>
                      {a.employee.name} · {ABSENCE_LABELS[a.type] ?? a.type}
                      {a.status === "PENDING" ? " (beantragt)" : ""}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {/* Desktop: Tabelle */}
          <div className="hidden overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] lg:block">
            <table className="min-w-[960px] w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--surface-2)]/70">
                  <th className="sticky left-0 z-10 bg-[var(--surface-2)] px-3 py-3 text-left font-semibold text-[var(--ink)]">
                    Schicht
                  </th>
                  {data.days.map((d) => {
                    const hol = holidayName(d);
                    return (
                      <th
                        key={d}
                        title={hol ?? undefined}
                        className={`min-w-[160px] px-3 py-3 text-left font-semibold ${
                          hol
                            ? "bg-[#fffbeb] text-[var(--warn)]"
                            : "text-[var(--ink)]"
                        }`}
                      >
                        {formatDayLabel(d)}
                        {hol ? (
                          <div className="mt-0.5 text-[10px] font-normal leading-tight">
                            {hol}
                          </div>
                        ) : null}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.shifts.map((shift) => (
                  <tr key={shift.id} className="border-b border-[var(--line)] align-top">
                    <td className="sticky left-0 z-10 bg-[var(--surface)] px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: shift.color }}
                        />
                        <div>
                          <div className="font-semibold">
                            {shift.name}{" "}
                            <span className="text-xs font-normal text-[var(--muted)]">
                              ({shift.kind === "NIGHT" ? "Nacht" : "Tag"})
                            </span>
                          </div>
                          <div className="text-xs text-[var(--muted)]">
                            {shift.startTime}–{shift.endTime}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {shift.requirements.map((r) => (
                          <span
                            key={r.competencyId}
                            className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--ink-soft)]"
                            title={`Mindestens ${r.minCount}`}
                          >
                            {r.competency.name} ×{r.minCount}
                          </span>
                        ))}
                      </div>
                    </td>
                    {data.days.map((day) => {
                      const people = shiftPeople(day, shift.id);
                      const key = cellKey(day, shift.id);
                      return (
                        <td key={day} className="px-2 py-2">
                          {people.length === 0 ? (
                            <span className="text-xs text-[var(--muted)]">—</span>
                          ) : (
                            <ul className="space-y-1.5">
                              {people.map((p) => (
                                <PersonCard key={p.id} p={p} cellKeyStr={key} compact />
                              ))}
                            </ul>
                          )}
                          {editMode ? (
                            <AddControl day={day} shiftId={shift.id} />
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="bg-[#fff1f2]/60 align-top">
                  <td className="sticky left-0 z-10 bg-[#fff1f2] px-3 py-3 font-semibold text-[var(--danger)]">
                    Abwesend
                  </td>
                  {data.days.map((day) => {
                    const abs = dayAbsences(day);
                    return (
                      <td key={day} className="px-2 py-2">
                        {abs.length === 0 ? (
                          <span className="text-xs text-[var(--muted)]">—</span>
                        ) : (
                          <ul className="space-y-1">
                            {abs.map((a) => (
                              <li
                                key={a.id}
                                className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs"
                              >
                                <span className="font-medium">{a.employee.name}</span>
                                <span className="text-[var(--muted)]">
                                  {" "}
                                  · {ABSENCE_LABELS[a.type] ?? a.type}
                                  {a.status === "PENDING" ? " (beantragt)" : ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
