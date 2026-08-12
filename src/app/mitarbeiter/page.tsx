"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  PageHeader,
  Panel,
  Button,
  Input,
  Select,
  Badge,
  EmptyState,
  ErrorBanner,
} from "@/components/ui";
import { apiGet, apiSend } from "@/lib/api";
import { toISODate } from "@/lib/dates";

type Competency = { id: string; name: string; color: string };
type ShiftPreference = "ANY" | "DAY_ONLY" | "NIGHT_ONLY" | "ROTATING";
type ShiftKind = "DAY" | "NIGHT";
type HoursPeriod = "MONTH" | "QUARTER";

type Employee = {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
  maxShifts: number;
  vacationDaysPerYear: number;
  shiftPreference: ShiftPreference;
  rotationWeeks: number;
  rotationStartDate: string | null;
  rotationStartKind: ShiftKind;
  targetHours: number | null;
  hoursPeriod: HoursPeriod;
  competencies: { competency: Competency }[];
};

const PREFERENCE_LABELS: Record<ShiftPreference, string> = {
  ANY: "Egal (Tag & Nacht)",
  DAY_ONLY: "Nur Tagschicht",
  NIGHT_ONLY: "Nur Nachtschicht",
  ROTATING: "Wechseldienst",
};

export default function MitarbeiterPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [maxShifts, setMaxShifts] = useState(5);
  const [vacationDays, setVacationDays] = useState(30);
  const [selected, setSelected] = useState<string[]>([]);
  const [shiftPreference, setShiftPreference] = useState<ShiftPreference>("ANY");
  const [rotationWeeks, setRotationWeeks] = useState(1);
  const [rotationStartDate, setRotationStartDate] = useState(() =>
    toISODate(new Date()),
  );
  const [rotationStartKind, setRotationStartKind] = useState<ShiftKind>("DAY");
  const [targetHours, setTargetHours] = useState<string>("");
  const [hoursPeriod, setHoursPeriod] = useState<HoursPeriod>("MONTH");
  const [editing, setEditing] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [e, c] = await Promise.all([
        apiGet<Employee[]>("/api/employees"),
        apiGet<Competency[]>("/api/competencies"),
      ]);
      if (!Array.isArray(e) || !Array.isArray(c)) {
        throw new Error(
          "Unerwartete Serverantwort. Oft fehlt die Datenbank oder der Seed.",
        );
      }
      setEmployees(e);
      setCompetencies(c);
    } catch (err) {
      setEmployees([]);
      setCompetencies([]);
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function toggleComp(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function startEdit(emp: Employee) {
    setEditing(emp);
    setName(emp.name);
    setEmail(emp.email ?? "");
    setMaxShifts(emp.maxShifts);
    setVacationDays(emp.vacationDaysPerYear ?? 30);
    setSelected(emp.competencies.map((c) => c.competency.id));
    setShiftPreference(emp.shiftPreference ?? "ANY");
    setRotationWeeks(emp.rotationWeeks ?? 1);
    setRotationStartDate(emp.rotationStartDate?.slice(0, 10) ?? toISODate(new Date()));
    setRotationStartKind(emp.rotationStartKind ?? "DAY");
    setTargetHours(emp.targetHours != null ? String(emp.targetHours) : "");
    setHoursPeriod(emp.hoursPeriod ?? "MONTH");
  }

  function resetForm() {
    setEditing(null);
    setName("");
    setEmail("");
    setMaxShifts(5);
    setVacationDays(30);
    setSelected([]);
    setShiftPreference("ANY");
    setRotationWeeks(1);
    setRotationStartDate(toISODate(new Date()));
    setRotationStartKind("DAY");
    setTargetHours("");
    setHoursPeriod("MONTH");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      name,
      email: email || null,
      maxShifts,
      vacationDaysPerYear: vacationDays,
      competencyIds: selected,
      active: true,
      shiftPreference,
      rotationWeeks,
      rotationStartDate: shiftPreference === "ROTATING" ? rotationStartDate : null,
      rotationStartKind,
      targetHours: targetHours === "" ? null : Number(targetHours),
      hoursPeriod,
    };

    try {
      if (editing) {
        await apiSend(`/api/employees/${editing.id}`, "PATCH", payload);
      } else {
        await apiSend("/api/employees", "POST", payload);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    }
  }

  async function remove(id: string) {
    if (!confirm("Mitarbeiter wirklich löschen?")) return;
    try {
      await apiSend(`/api/employees/${id}`, "DELETE");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    }
  }

  async function toggleActive(emp: Employee) {
    try {
      await apiSend(`/api/employees/${emp.id}`, "PATCH", {
        active: !emp.active,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aktualisieren fehlgeschlagen");
    }
  }

  function preferenceSummary(emp: Employee): string {
    if (emp.shiftPreference === "ROTATING") {
      const startLabel = emp.rotationStartKind === "NIGHT" ? "Nacht" : "Tag";
      return `Wechseldienst (${emp.rotationWeeks} Woche${emp.rotationWeeks > 1 ? "n" : ""} ${startLabel}/…)`;
    }
    return PREFERENCE_LABELS[emp.shiftPreference] ?? "Egal";
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Mitarbeiter"
        subtitle="Kompetenzen, Schichtpräferenz und Sollstunden hinterlegen – der Planer berücksichtigt alles automatisch."
      />

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Panel>
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-lg">
            {editing ? "Bearbeiten" : "Neu anlegen"}
          </h2>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="E-Mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Max. Schichten / Woche"
              type="number"
              min={1}
              max={14}
              value={maxShifts}
              onChange={(e) => setMaxShifts(Number(e.target.value))}
            />
            <Input
              label="Urlaubstage / Jahr"
              type="number"
              min={0}
              max={60}
              value={vacationDays}
              onChange={(e) => setVacationDays(Number(e.target.value))}
            />

            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/40 p-3 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Schichtpräferenz
              </p>
              <Select
                label="Präferenz"
                value={shiftPreference}
                onChange={(e) =>
                  setShiftPreference(e.target.value as ShiftPreference)
                }
              >
                <option value="ANY">Egal (Tag &amp; Nacht)</option>
                <option value="DAY_ONLY">Nur Tagschicht</option>
                <option value="NIGHT_ONLY">Nur Nachtschicht</option>
                <option value="ROTATING">Wechseldienst</option>
              </Select>

              {shiftPreference === "ROTATING" ? (
                <>
                  <Input
                    label="Rhythmus (Wochen pro Phase)"
                    type="number"
                    min={1}
                    max={12}
                    value={rotationWeeks}
                    onChange={(e) => setRotationWeeks(Number(e.target.value))}
                  />
                  <Select
                    label="Beginnt mit"
                    value={rotationStartKind}
                    onChange={(e) =>
                      setRotationStartKind(e.target.value as ShiftKind)
                    }
                  >
                    <option value="DAY">Tag</option>
                    <option value="NIGHT">Nacht</option>
                  </Select>
                  <Input
                    label="Ab wann (Referenzdatum)"
                    type="date"
                    value={rotationStartDate}
                    onChange={(e) => setRotationStartDate(e.target.value)}
                  />
                  <p className="text-xs text-[var(--muted)]">
                    z. B. 1 Woche = wöchentlicher Wechsel Tag/Nacht, 2 Wochen =
                    zwei Wochen Tag, dann zwei Wochen Nacht usw.
                  </p>
                </>
              ) : null}
            </div>

            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/40 p-3 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Sollstunden
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Stunden-Ziel"
                  type="number"
                  min={0}
                  step="0.5"
                  placeholder="z. B. 160"
                  value={targetHours}
                  onChange={(e) => setTargetHours(e.target.value)}
                />
                <Select
                  label="Zeitraum"
                  value={hoursPeriod}
                  onChange={(e) => setHoursPeriod(e.target.value as HoursPeriod)}
                >
                  <option value="MONTH">pro Monat</option>
                  <option value="QUARTER">pro Quartal</option>
                </Select>
              </div>
              <p className="text-xs text-[var(--muted)]">
                Leer lassen, wenn Stunden keine Rolle spielen sollen (dann zählt
                „Max. Schichten“).
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Kompetenzen
              </p>
              <div className="flex flex-wrap gap-2">
                {competencies.map((c) => {
                  const on = selected.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleComp(c.id)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                        on
                          ? "text-white"
                          : "bg-[var(--surface-2)] text-[var(--ink-soft)]"
                      }`}
                      style={on ? { backgroundColor: c.color } : undefined}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit">{editing ? "Speichern" : "Anlegen"}</Button>
              {editing ? (
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Abbrechen
                </Button>
              ) : null}
            </div>
          </form>
        </Panel>

        <div className="space-y-3">
          {loading ? (
            <EmptyState text="Lade Mitarbeiter…" />
          ) : employees.length === 0 ? (
            <EmptyState text="Noch keine Mitarbeiter." />
          ) : (
            employees.map((emp) => (
              <Panel key={emp.id} className={!emp.active ? "opacity-60" : ""}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-[family-name:var(--font-display)] text-lg">
                      {emp.name}
                    </h3>
                    <p className="text-sm text-[var(--muted)]">
                      {emp.email || "Keine E-Mail"} · max. {emp.maxShifts} Schichten
                      · {emp.vacationDaysPerYear ?? 30} Urlaubstage
                      {!emp.active ? " · inaktiv" : ""}
                    </p>
                    <p className="mt-1 text-sm text-[var(--ink-soft)]">
                      {preferenceSummary(emp)}
                      {emp.targetHours != null
                        ? ` · Ziel: ${emp.targetHours} Std./${emp.hoursPeriod === "QUARTER" ? "Quartal" : "Monat"}`
                        : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {emp.competencies.length === 0 ? (
                        <span className="text-xs text-[var(--warn)]">
                          Keine Kompetenzen
                        </span>
                      ) : (
                        emp.competencies.map((c) => (
                          <Badge key={c.competency.id} color={c.competency.color}>
                            {c.competency.name}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => startEdit(emp)}>
                      Bearbeiten
                    </Button>
                    <Button variant="ghost" onClick={() => toggleActive(emp)}>
                      {emp.active ? "Deaktivieren" : "Aktivieren"}
                    </Button>
                    <Button variant="danger" onClick={() => remove(emp.id)}>
                      Löschen
                    </Button>
                  </div>
                </div>
              </Panel>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
