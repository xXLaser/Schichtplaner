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
type ShiftKind = "DAY" | "NIGHT" | "INTERMEDIATE";
type HoursPeriod = "MONTH" | "QUARTER";
type EmploymentType = "FULL_TIME" | "PART_TIME";
type DutyModel = "ROTATION_4_4" | "WEEKDAYS" | "CUSTOM";
type ShiftTemplate = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  kind: ShiftKind;
};

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
  employmentType: EmploymentType;
  dutyModel: DutyModel;
  dutyOnDays: number;
  dutyOffDays: number;
  dutyCycleStartDate: string | null;
  allowFifthShiftPerMonth: boolean;
  partTimeStartTime: string;
  partTimeEndTime: string;
  workWeekdays: string;
  allowIntermediateShifts: boolean;
  defaultShiftTemplateId: string | null;
  competencies: { competency: Competency }[];
};

const PREFERENCE_LABELS: Record<ShiftPreference, string> = {
  ANY: "Egal (Tag & Nacht)",
  DAY_ONLY: "Nur Tagschicht",
  NIGHT_ONLY: "Nur Nachtschicht",
  ROTATING: "Wechseldienst",
};

const DUTY_LABELS: Record<DutyModel, string> = {
  ROTATION_4_4: "4/4 (Dienst/Frei)",
  WEEKDAYS: "Mo–Fr Teilzeit",
  CUSTOM: "Individueller Zyklus",
};

export default function MitarbeiterPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [shifts, setShifts] = useState<ShiftTemplate[]>([]);
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
  const [employmentType, setEmploymentType] =
    useState<EmploymentType>("FULL_TIME");
  const [dutyModel, setDutyModel] = useState<DutyModel>("ROTATION_4_4");
  const [dutyOnDays, setDutyOnDays] = useState(4);
  const [dutyOffDays, setDutyOffDays] = useState(4);
  const [dutyCycleStartDate, setDutyCycleStartDate] = useState(() =>
    toISODate(new Date()),
  );
  const [allowFifth, setAllowFifth] = useState(true);
  const [partTimeStart, setPartTimeStart] = useState("09:00");
  const [partTimeEnd, setPartTimeEnd] = useState("15:00");
  const [workWeekdays, setWorkWeekdays] = useState("1,2,3,4,5");
  const [allowIntermediate, setAllowIntermediate] = useState(false);
  const [defaultShiftId, setDefaultShiftId] = useState("");
  const [editing, setEditing] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [e, c, s] = await Promise.all([
        apiGet<Employee[]>("/api/employees"),
        apiGet<Competency[]>("/api/competencies"),
        apiGet<ShiftTemplate[]>("/api/shifts"),
      ]);
      if (!Array.isArray(e) || !Array.isArray(c)) {
        throw new Error(
          "Unerwartete Serverantwort. Oft fehlt die Datenbank oder der Seed.",
        );
      }
      setEmployees(e);
      setCompetencies(c);
      setShifts(Array.isArray(s) ? s : []);
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

  function applyEmploymentDefaults(type: EmploymentType) {
    setEmploymentType(type);
    if (type === "PART_TIME") {
      setDutyModel("WEEKDAYS");
      setMaxShifts(5);
      setPartTimeStart("09:00");
      setPartTimeEnd("15:00");
      setWorkWeekdays("1,2,3,4,5");
      setAllowFifth(false);
      setTargetHours("120");
    } else {
      setDutyModel("ROTATION_4_4");
      setDutyOnDays(4);
      setDutyOffDays(4);
      setAllowFifth(true);
      setMaxShifts(5);
      setTargetHours("160");
    }
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
    setRotationStartDate(
      emp.rotationStartDate?.slice(0, 10) ?? toISODate(new Date()),
    );
    setRotationStartKind(emp.rotationStartKind ?? "DAY");
    setTargetHours(emp.targetHours != null ? String(emp.targetHours) : "");
    setHoursPeriod(emp.hoursPeriod ?? "MONTH");
    setEmploymentType(emp.employmentType ?? "FULL_TIME");
    setDutyModel(emp.dutyModel ?? "ROTATION_4_4");
    setDutyOnDays(emp.dutyOnDays ?? 4);
    setDutyOffDays(emp.dutyOffDays ?? 4);
    setDutyCycleStartDate(
      emp.dutyCycleStartDate?.slice(0, 10) ?? toISODate(new Date()),
    );
    setAllowFifth(emp.allowFifthShiftPerMonth ?? true);
    setPartTimeStart(emp.partTimeStartTime ?? "09:00");
    setPartTimeEnd(emp.partTimeEndTime ?? "15:00");
    setWorkWeekdays(emp.workWeekdays ?? "1,2,3,4,5");
    setAllowIntermediate(emp.allowIntermediateShifts ?? false);
    setDefaultShiftId(emp.defaultShiftTemplateId ?? "");
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
    setTargetHours("160");
    setHoursPeriod("MONTH");
    setEmploymentType("FULL_TIME");
    setDutyModel("ROTATION_4_4");
    setDutyOnDays(4);
    setDutyOffDays(4);
    setDutyCycleStartDate(toISODate(new Date()));
    setAllowFifth(true);
    setPartTimeStart("09:00");
    setPartTimeEnd("15:00");
    setWorkWeekdays("1,2,3,4,5");
    setAllowIntermediate(false);
    setDefaultShiftId("");
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
      employmentType,
      dutyModel,
      dutyOnDays,
      dutyOffDays,
      dutyCycleStartDate:
        dutyModel === "WEEKDAYS" ? null : dutyCycleStartDate || null,
      allowFifthShiftPerMonth: allowFifth,
      partTimeStartTime: partTimeStart,
      partTimeEndTime: partTimeEnd,
      workWeekdays,
      allowIntermediateShifts: allowIntermediate,
      defaultShiftTemplateId: defaultShiftId || null,
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
      setError(
        err instanceof Error ? err.message : "Aktualisieren fehlgeschlagen",
      );
    }
  }

  function modelSummary(emp: Employee): string {
    const parts = [
      emp.employmentType === "PART_TIME" ? "Teilzeit" : "Vollzeit",
      DUTY_LABELS[emp.dutyModel] ?? emp.dutyModel,
    ];
    if (emp.dutyModel === "ROTATION_4_4" || emp.dutyModel === "CUSTOM") {
      parts.push(`${emp.dutyOnDays}/${emp.dutyOffDays}`);
      if (emp.allowFifthShiftPerMonth) parts.push("5. Dienst/Monat möglich");
    }
    if (emp.dutyModel === "WEEKDAYS") {
      parts.push(`${emp.partTimeStartTime}–${emp.partTimeEndTime}`);
    }
    if (emp.allowIntermediateShifts) parts.push("Zwischendienst ok");
    return parts.join(" · ");
  }

  function preferenceSummary(emp: Employee): string {
    if (emp.shiftPreference === "ROTATING") {
      const startLabel = emp.rotationStartKind === "NIGHT" ? "Nacht" : "Tag";
      return `Wechseldienst (${emp.rotationWeeks} Woche${emp.rotationWeeks > 1 ? "n" : ""} ${startLabel}/…)`;
    }
    return PREFERENCE_LABELS[emp.shiftPreference] ?? "Egal";
  }

  const showCycle =
    dutyModel === "ROTATION_4_4" || dutyModel === "CUSTOM";
  const showPartTime = dutyModel === "WEEKDAYS";

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Mitarbeiter"
        subtitle="Dienstmodell, Kompetenzen und Sollstunden – Grundlage für Ursprungsdienstplan und automatische Planung."
      />

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
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
              label="Urlaubstage / Jahr"
              type="number"
              min={0}
              max={60}
              value={vacationDays}
              onChange={(e) => setVacationDays(Number(e.target.value))}
            />

            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/40 p-3 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Dienstmodell
              </p>
              <Select
                label="Beschäftigung"
                value={employmentType}
                onChange={(e) =>
                  applyEmploymentDefaults(e.target.value as EmploymentType)
                }
              >
                <option value="FULL_TIME">Vollzeit</option>
                <option value="PART_TIME">Teilzeit</option>
              </Select>
              <Select
                label="Modell"
                value={dutyModel}
                onChange={(e) => {
                  const m = e.target.value as DutyModel;
                  setDutyModel(m);
                  if (m === "WEEKDAYS") setEmploymentType("PART_TIME");
                  if (m === "ROTATION_4_4") {
                    setDutyOnDays(4);
                    setDutyOffDays(4);
                    setEmploymentType("FULL_TIME");
                  }
                }}
              >
                <option value="ROTATION_4_4">4 Tage Dienst / 4 Tage frei</option>
                <option value="WEEKDAYS">Mo–Fr (Teilzeit 9–15)</option>
                <option value="CUSTOM">Individueller Dienst/Frei-Zyklus</option>
              </Select>

              {showCycle ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Tage Dienst"
                      type="number"
                      min={1}
                      max={14}
                      value={dutyOnDays}
                      onChange={(e) => setDutyOnDays(Number(e.target.value))}
                    />
                    <Input
                      label="Tage frei"
                      type="number"
                      min={0}
                      max={14}
                      value={dutyOffDays}
                      onChange={(e) => setDutyOffDays(Number(e.target.value))}
                    />
                  </div>
                  <Input
                    label="Zyklus startet am"
                    type="date"
                    value={dutyCycleStartDate}
                    onChange={(e) => setDutyCycleStartDate(e.target.value)}
                  />
                  <p className="text-xs text-[var(--muted)]">
                    Für durchgehende Abdeckung sollten zwei Gruppen den Zyklusbeginn um die Freitage versetzt setzen (z. B. 4 Tage auseinander).
                  </p>
                  <label className="flex items-start gap-2 text-sm text-[var(--ink-soft)]">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={allowFifth}
                      onChange={(e) => setAllowFifth(e.target.checked)}
                    />
                    <span>
                      Überstundenpauschale: einmal im Monat bis zu 5 Dienste in
                      einer Woche erlaubt
                    </span>
                  </label>
                </>
              ) : null}

              {showPartTime ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Von"
                      type="time"
                      value={partTimeStart}
                      onChange={(e) => setPartTimeStart(e.target.value)}
                    />
                    <Input
                      label="Bis"
                      type="time"
                      value={partTimeEnd}
                      onChange={(e) => setPartTimeEnd(e.target.value)}
                    />
                  </div>
                  <Input
                    label="Wochentage (1=Mo … 7=So)"
                    value={workWeekdays}
                    onChange={(e) => setWorkWeekdays(e.target.value)}
                    placeholder="1,2,3,4,5"
                  />
                </>
              ) : null}

              <label className="flex items-start gap-2 text-sm text-[var(--ink-soft)]">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={allowIntermediate}
                  onChange={(e) => setAllowIntermediate(e.target.checked)}
                />
                <span>
                  Zwischendienste erlaubt (z.&nbsp;B. 11–23 Uhr; Ruhezeit 12 Std.
                  gilt trotzdem)
                </span>
              </label>

              <Select
                label="Standard-Schicht (optional)"
                value={defaultShiftId}
                onChange={(e) => setDefaultShiftId(e.target.value)}
              >
                <option value="">— automatisch —</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.startTime}–{s.endTime})
                  </option>
                ))}
              </Select>

              <Input
                label="Max. Schichten / Woche (Orientierung)"
                type="number"
                min={1}
                max={14}
                value={maxShifts}
                onChange={(e) => setMaxShifts(Number(e.target.value))}
              />
            </div>

            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/40 p-3 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Schichtpräferenz (Tag/Nacht)
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
                      {emp.email || "Keine E-Mail"} ·{" "}
                      {emp.vacationDaysPerYear ?? 30} Urlaubstage
                      {!emp.active ? " · inaktiv" : ""}
                    </p>
                    <p className="mt-1 text-sm text-[var(--ink-soft)]">
                      {modelSummary(emp)}
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--ink-soft)]">
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
