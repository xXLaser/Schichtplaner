"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  PageHeader,
  Panel,
  Button,
  Input,
  Select,
  Textarea,
  EmptyState,
} from "@/components/ui";
import { ABSENCE_LABELS, toISODate } from "@/lib/dates";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

type Employee = { id: string; name: string };
type Absence = {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  note: string | null;
  employee: Employee;
};

export default function AbwesenheitenPage() {
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState("VACATION");
  const [startDate, setStartDate] = useState(toISODate(new Date()));
  const [endDate, setEndDate] = useState(toISODate(new Date()));
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [hint, setHint] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [a, e] = await Promise.all([
      fetch("/api/absences").then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
    ]);
    setAbsences(
      a.map((x: Absence & { startDate: string; endDate: string }) => ({
        ...x,
        startDate: typeof x.startDate === "string" ? x.startDate.slice(0, 10) : x.startDate,
        endDate: typeof x.endDate === "string" ? x.endDate.slice(0, 10) : x.endDate,
      })),
    );
    setEmployees(e);
    if (!employeeId && e[0]) setEmployeeId(e[0].id);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/absences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId,
        type,
        status: "APPROVED",
        startDate,
        endDate,
        note: note || null,
        compensate: true,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setHint(json.error ?? "Speichern fehlgeschlagen");
      return;
    }

    setNote("");
    const compensate = json.compensation;
    setHint(
      `Abwesenheit gespeichert` +
        (compensate
          ? ` und Plan kompensiert (${compensate.created ?? 0} Zuweisungen` +
            (compensate.warnings?.length
              ? `, ${compensate.warnings.length} Kompetenzlücken`
              : "") +
            ")"
          : "") +
        ". Für Urlaubsplanung mit Kontingent besser den Urlaubsplaner nutzen.",
    );
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Abwesenheit löschen?")) return;
    await fetch(`/api/absences/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Abwesenheiten"
        subtitle="Krankenstände und sonstige Absenzen schnell erfassen. Urlaub mit Resttagen und Kalender: Seite „Urlaubsplaner“."
      />

      {hint ? (
        <Panel className="mb-6 border-[var(--accent)]/30 bg-[#f0fdfa]">
          <p className="text-sm text-[var(--ink-soft)]">{hint}</p>
        </Panel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Panel>
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-lg">
            Erfassen
          </h2>
          <form onSubmit={onSubmit} className="space-y-3">
            <Select
              label="Mitarbeiter"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </Select>
            <Select
              label="Art"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="VACATION">Urlaub</option>
              <option value="SICK">Krankenstand</option>
              <option value="OTHER">Sonstiges</option>
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
            <Button type="submit">Speichern</Button>
          </form>
        </Panel>

        <div className="space-y-3">
          {loading ? (
            <EmptyState text="Lade Abwesenheiten…" />
          ) : absences.length === 0 ? (
            <EmptyState text="Keine Abwesenheiten erfasst." />
          ) : (
            absences.map((a) => (
              <Panel key={a.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-[family-name:var(--font-display)] text-lg">
                      {a.employee.name}
                    </h3>
                    <p className="text-sm text-[var(--ink-soft)]">
                      <span
                        className={
                          a.type === "SICK"
                            ? "text-[var(--danger)]"
                            : "text-[var(--accent)]"
                        }
                      >
                        {ABSENCE_LABELS[a.type] ?? a.type}
                      </span>
                      {" · "}
                      {format(parseISO(a.startDate), "dd.MM.yyyy", { locale: de })}
                      {" – "}
                      {format(parseISO(a.endDate), "dd.MM.yyyy", { locale: de })}
                    </p>
                    {a.note ? (
                      <p className="mt-1 text-sm text-[var(--muted)]">{a.note}</p>
                    ) : null}
                  </div>
                  <Button variant="danger" onClick={() => remove(a.id)}>
                    Löschen
                  </Button>
                </div>
              </Panel>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
