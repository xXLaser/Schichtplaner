"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  PageHeader,
  Panel,
  Button,
  Input,
  Select,
  Textarea,
  EmptyState,
} from "@/components/ui";
import { format, parseISO, getDate } from "date-fns";
import { de } from "date-fns/locale";

type Budget = {
  employeeId: string;
  name: string;
  vacationDaysPerYear: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
};

type Entry = {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  status: string;
  note: string | null;
  days: number;
};

type Overlap = {
  date: string;
  count: number;
  names: string[];
  warning: boolean;
};

type VacationData = {
  year: number;
  budgets: Budget[];
  entries: Entry[];
  overlaps: Overlap[];
  maxSimultaneous: number;
  employees: { id: string; name: string; vacationDaysPerYear: number }[];
  calendar?: { days: string[]; pad: number };
  month?: number;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Beantragt",
  APPROVED: "Genehmigt",
  REJECTED: "Abgelehnt",
};

export default function UrlaubPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<VacationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [autoApprove, setAutoApprove] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/vacation?year=${year}&month=${month}`);
      const json = await res.json();
      setData(json);
      if (!employeeId && json.employees?.[0]) {
        setEmployeeId(json.employees[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [year, month, employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dayPeople = useMemo(() => {
    if (!selectedDay || !data) return [];
    return data.overlaps.find((o) => o.date === selectedDay)?.names ?? [];
  }, [selectedDay, data]);

  const monthOverlaps = useMemo(() => {
    if (!data) return new Map<string, Overlap>();
    const map = new Map<string, Overlap>();
    for (const o of data.overlaps) {
      if (o.date.startsWith(`${year}-${String(month).padStart(2, "0")}`)) {
        map.set(o.date, o);
      }
    }
    return map;
  }, [data, year, month]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const res = await fetch("/api/absences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId,
        type: "VACATION",
        status: autoApprove ? "APPROVED" : "PENDING",
        startDate,
        endDate,
        note: note || null,
        compensate: autoApprove,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Antrag fehlgeschlagen");
      return;
    }
    setMessage(
      autoApprove
        ? "Urlaub genehmigt und Dienstplan kompensiert."
        : "Urlaubsantrag gespeichert (noch nicht genehmigt).",
    );
    setNote("");
    await load();
  }

  async function setStatus(id: string, status: "APPROVED" | "REJECTED" | "PENDING") {
    await fetch(`/api/absences/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, compensate: status === "APPROVED" }),
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Urlaubseintrag löschen?")) return;
    await fetch(`/api/absences/${id}`, { method: "DELETE" });
    await load();
  }

  const monthLabel = format(new Date(year, month - 1, 1), "MMMM yyyy", {
    locale: de,
  });

  return (
    <div className="animate-fade-up pb-4">
      <PageHeader
        title="Urlaubsplaner"
        subtitle="Jahresübersicht, Resturlaub und Überschneidungen im Team – mobil und am PC."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setYear((y) => y - 1)}
            >
              ← {year - 1}
            </Button>
            <Button variant="secondary" onClick={() => setYear(now.getFullYear())}>
              {year}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setYear((y) => y + 1)}
            >
              {year + 1} →
            </Button>
          </>
        }
      />

      {message ? (
        <Panel className="mb-4 border-[var(--accent)]/30 bg-[#f0fdfa]">
          <p className="text-sm">{message}</p>
        </Panel>
      ) : null}
      {error ? (
        <Panel className="mb-4 border-[var(--danger)]/30 bg-[#fff1f2]">
          <p className="text-sm text-[var(--danger)]">{error}</p>
        </Panel>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <Panel className="h-fit">
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-lg">
            Urlaub eintragen
          </h2>
          <form onSubmit={onSubmit} className="space-y-3">
            <Select
              label="Mitarbeiter"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
            >
              {(data?.employees ?? []).map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </Select>
            <Input
              label="Von"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <Input
              label="Bis"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
            <Textarea
              label="Notiz"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <label className="flex items-start gap-2 text-sm text-[var(--ink-soft)]">
              <input
                type="checkbox"
                className="mt-1"
                checked={autoApprove}
                onChange={(e) => setAutoApprove(e.target.checked)}
              />
              Sofort genehmigen und Dienstplan kompensieren
            </label>
            <Button type="submit" className="w-full sm:w-auto">
              Speichern
            </Button>
          </form>
        </Panel>

        <div className="space-y-6">
          <Panel>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-lg capitalize">
                {monthLabel}
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (month === 1) {
                      setMonth(12);
                      setYear((y) => y - 1);
                    } else setMonth((m) => m - 1);
                  }}
                >
                  ←
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setMonth(now.getMonth() + 1);
                    setYear(now.getFullYear());
                  }}
                >
                  Heute
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (month === 12) {
                      setMonth(1);
                      setYear((y) => y + 1);
                    } else setMonth((m) => m + 1);
                  }}
                >
                  →
                </Button>
              </div>
            </div>

            {loading || !data?.calendar ? (
              <EmptyState text="Kalender wird geladen…" />
            ) : (
              <>
                <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] sm:text-xs">
                  {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: data.calendar.pad }).map((_, i) => (
                    <div key={`pad-${i}`} />
                  ))}
                  {data.calendar.days.map((day) => {
                    const overlap = monthOverlaps.get(day);
                    const isSel = selectedDay === day;
                    const isWeekend =
                      parseISO(day).getDay() === 0 ||
                      parseISO(day).getDay() === 6;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() =>
                          setSelectedDay((prev) => (prev === day ? null : day))
                        }
                        className={`min-h-[52px] rounded-lg border p-1 text-left transition sm:min-h-[64px] ${
                          isSel
                            ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30"
                            : "border-[var(--line)]"
                        } ${
                          overlap?.warning
                            ? "bg-[#fff7ed]"
                            : overlap
                              ? "bg-[#ecfdf5]"
                              : isWeekend
                                ? "bg-[var(--surface-2)]/50"
                                : "bg-white"
                        }`}
                      >
                        <div className="text-xs font-semibold sm:text-sm">
                          {getDate(parseISO(day))}
                        </div>
                        {overlap ? (
                          <div
                            className={`mt-0.5 text-[10px] leading-tight sm:text-xs ${
                              overlap.warning
                                ? "text-[var(--warn)]"
                                : "text-[var(--accent)]"
                            }`}
                          >
                            {overlap.count} weg
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {selectedDay ? (
                  <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/40 p-3 text-sm">
                    <p className="font-medium">
                      {format(parseISO(selectedDay), "EEEE, dd.MM.yyyy", {
                        locale: de,
                      })}
                    </p>
                    {dayPeople.length === 0 ? (
                      <p className="mt-1 text-[var(--muted)]">Niemand im Urlaub</p>
                    ) : (
                      <ul className="mt-2 space-y-1">
                        {dayPeople.map((n) => (
                          <li key={n}>{n}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
                <p className="mt-3 text-xs text-[var(--muted)]">
                  Warnung ab {data.maxSimultaneous} Personen gleichzeitig im
                  Urlaub (Werktage).
                </p>
              </>
            )}
          </Panel>

          <Panel>
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-lg">
              Resturlaub {year}
            </h2>
            {loading || !data ? (
              <EmptyState text="Kontingente werden geladen…" />
            ) : (
              <div className="space-y-3">
                {data.budgets.map((b) => {
                  const pct = Math.min(
                    100,
                    Math.round(
                      ((b.usedDays + b.pendingDays) / Math.max(1, b.vacationDaysPerYear)) *
                        100,
                    ),
                  );
                  return (
                    <div key={b.employeeId}>
                      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium">{b.name}</span>
                        <span className="text-[var(--muted)]">
                          {b.remainingDays} frei · {b.usedDays} genommen
                          {b.pendingDays ? ` · ${b.pendingDays} beantragt` : ""}{" "}
                          / {b.vacationDaysPerYear}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                        <div
                          className={`h-full rounded-full transition-all ${
                            b.remainingDays <= 3
                              ? "bg-[var(--warn)]"
                              : "bg-[var(--accent)]"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel>
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-lg">
              Anträge & Einträge
            </h2>
            {!data || data.entries.length === 0 ? (
              <EmptyState text="Noch kein Urlaub für dieses Jahr." />
            ) : (
              <ul className="space-y-3">
                {data.entries.map((e) => (
                  <li
                    key={e.id}
                    className="rounded-lg border border-[var(--line)] bg-white p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{e.employeeName}</p>
                        <p className="text-sm text-[var(--ink-soft)]">
                          {format(parseISO(e.startDate), "dd.MM.yyyy", {
                            locale: de,
                          })}{" "}
                          –{" "}
                          {format(parseISO(e.endDate), "dd.MM.yyyy", {
                            locale: de,
                          })}{" "}
                          · {e.days} Werktage
                        </p>
                        <p className="mt-1 text-xs">
                          <span
                            className={
                              e.status === "APPROVED"
                                ? "text-[var(--ok)]"
                                : e.status === "PENDING"
                                  ? "text-[var(--warn)]"
                                  : "text-[var(--danger)]"
                            }
                          >
                            {STATUS_LABEL[e.status] ?? e.status}
                          </span>
                          {e.note ? (
                            <span className="text-[var(--muted)]"> · {e.note}</span>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {e.status === "PENDING" ? (
                          <>
                            <Button
                              variant="primary"
                              onClick={() => setStatus(e.id, "APPROVED")}
                            >
                              Genehmigen
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => setStatus(e.id, "REJECTED")}
                            >
                              Ablehnen
                            </Button>
                          </>
                        ) : null}
                        {e.status === "REJECTED" ? (
                          <Button
                            variant="secondary"
                            onClick={() => setStatus(e.id, "PENDING")}
                          >
                            Wieder öffnen
                          </Button>
                        ) : null}
                        <Button variant="danger" onClick={() => remove(e.id)}>
                          Löschen
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {data && data.overlaps.filter((o) => o.warning).length > 0 ? (
            <Panel className="border-[var(--warn)]/40 bg-[#fff7ed]">
              <h2 className="mb-2 font-[family-name:var(--font-display)] text-lg text-[var(--warn)]">
                Kritische Überschneidungen
              </h2>
              <ul className="space-y-1 text-sm">
                {data.overlaps
                  .filter((o) => o.warning)
                  .slice(0, 12)
                  .map((o) => (
                    <li key={o.date}>
                      {format(parseISO(o.date), "dd.MM.yyyy", { locale: de })}:{" "}
                      {o.names.join(", ")} ({o.count})
                    </li>
                  ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
