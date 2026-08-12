"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays } from "date-fns";
import { PageHeader, Panel, Button, Badge, EmptyState } from "@/components/ui";
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

type ScheduleData = {
  days: string[];
  shifts: Shift[];
  assignments: Assignment[];
  absences: Absence[];
  competencies: Competency[];
};

export default function DienstplanPage() {
  const [week, setWeek] = useState(() => toISODate(weekStart()));
  const [data, setData] = useState<ScheduleData | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mobileDay, setMobileDay] = useState(() => toISODate(new Date()));

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
          (result.warnings?.length
            ? ` · ${result.warnings.length} Kompetenzlücken`
            : " · alle Anforderungen erfüllt"),
      );
      await load();
    } finally {
      setGenerating(false);
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

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Dienstplan"
        subtitle="Automatische Belegung nach Kompetenzen. Genehmigte Abwesenheiten werden kompensiert."
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
            <Button onClick={generate} disabled={generating}>
              {generating ? "Plant…" : "Plan neu generieren"}
            </Button>
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
              {data.days.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setMobileDay(d)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${
                    mobileDay === d
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--surface)] border border-[var(--line)] text-[var(--ink-soft)]"
                  }`}
                >
                  {formatDayLabel(d)}
                </button>
              ))}
            </div>

            {data.shifts.map((shift) => {
              const people = shiftPeople(mobileDay, shift.id);
              return (
                <Panel key={shift.id}>
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: shift.color }}
                    />
                    <div>
                      <div className="font-semibold">{shift.name}</div>
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
                        <li
                          key={p.id}
                          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2"
                        >
                          <div className="font-medium">{p.employee.name}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {p.employee.competencies.map((c) => (
                              <Badge key={c.competency.id} color={c.competency.color}>
                                {c.competency.name}
                              </Badge>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
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
                  {data.days.map((d) => (
                    <th
                      key={d}
                      className="min-w-[140px] px-3 py-3 text-left font-semibold text-[var(--ink)]"
                    >
                      {formatDayLabel(d)}
                    </th>
                  ))}
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
                          <div className="font-semibold">{shift.name}</div>
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
                      return (
                        <td key={day} className="px-2 py-2">
                          {people.length === 0 ? (
                            <span className="text-xs text-[var(--muted)]">—</span>
                          ) : (
                            <ul className="space-y-1.5">
                              {people.map((p) => (
                                <li
                                  key={p.id}
                                  className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5"
                                >
                                  <div className="font-medium text-[var(--ink)]">
                                    {p.employee.name}
                                  </div>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {p.employee.competencies.slice(0, 3).map((c) => (
                                      <Badge
                                        key={c.competency.id}
                                        color={c.competency.color}
                                      >
                                        {c.competency.name}
                                      </Badge>
                                    ))}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
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
