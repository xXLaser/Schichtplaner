"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { Panel, Button, Input, Select, EmptyState } from "@/components/ui";
import { apiSend } from "@/lib/api";
import { toISODate, weekStart, formatDateRange } from "@/lib/dates";

type OnboardingStatus = {
  completed: boolean;
  step: string;
  counts: {
    competencies: number;
    shifts: number;
    employees: number;
    baseEntries: number;
  };
  canProceed: {
    competencies: boolean;
    shifts: boolean;
    employees: boolean;
    schedule: boolean;
  };
};

type Competency = { id: string; name: string; color: string; description?: string | null };
type ShiftKind = "DAY" | "NIGHT" | "INTERMEDIATE";
type Shift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  kind: ShiftKind;
  sortOrder: number;
  requirements: { competencyId: string; minCount: number }[];
};
type Employee = {
  id: string;
  name: string;
  dutyModel: string;
  shiftPreference: string;
  competencies: { competencyId: string; competency: Competency }[];
};
type BaseEntry = {
  id: string;
  date: string;
  shiftTemplateId: string;
  employeeId: string;
  employee: { id: string; name: string };
};

const STEPS = [
  { id: "welcome", label: "Start" },
  { id: "competencies", label: "Kompetenzen" },
  { id: "shifts", label: "Schichten" },
  { id: "employees", label: "Mitarbeiter" },
  { id: "schedule", label: "Dienstplan" },
  { id: "apply", label: "Abschluss" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export default function SetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [step, setStep] = useState<StepId>("welcome");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [compName, setCompName] = useState("");
  const [compColor, setCompColor] = useState("#0f766e");

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftName, setShiftName] = useState("");
  const [shiftStart, setShiftStart] = useState("06:00");
  const [shiftEnd, setShiftEnd] = useState("18:00");
  const [shiftKind, setShiftKind] = useState<ShiftKind>("DAY");
  const [shiftColor, setShiftColor] = useState("#0f766e");
  const [reqCounts, setReqCounts] = useState<Record<string, number>>({});

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empName, setEmpName] = useState("");
  const [empPref, setEmpPref] = useState("ANY");
  const [empModel, setEmpModel] = useState("ROTATION_4_4");
  const [empComps, setEmpComps] = useState<string[]>([]);

  const [setupStart, setSetupStart] = useState(() => toISODate(weekStart()));
  const [baseEntries, setBaseEntries] = useState<BaseEntry[]>([]);
  const [pickEmp, setPickEmp] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  const setupEnd = useMemo(
    () => toISODate(addDays(new Date(setupStart + "T00:00:00"), 13)),
    [setupStart],
  );
  const setupDays = useMemo(() => {
    const start = new Date(setupStart + "T00:00:00");
    return Array.from({ length: 14 }, (_, i) => toISODate(addDays(start, i)));
  }, [setupStart]);

  const refreshStatus = useCallback(async () => {
    const res = await fetch("/api/onboarding", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Statusfehler");
    setStatus(json);
    if (json.completed) {
      router.replace("/dienstplan");
    }
    return json as OnboardingStatus;
  }, [router]);

  const loadCompetencies = useCallback(async () => {
    setCompetencies(await fetch("/api/competencies").then((r) => r.json()));
  }, []);
  const loadShifts = useCallback(async () => {
    setShifts(await fetch("/api/shifts").then((r) => r.json()));
  }, []);
  const loadEmployees = useCallback(async () => {
    setEmployees(await fetch("/api/employees").then((r) => r.json()));
  }, []);
  const loadBase = useCallback(async () => {
    await apiSend("/api/base-schedule", "POST", {
      action: "setup",
      startDate: setupStart,
    });
    const data = await fetch(
      `/api/base-schedule?from=${setupStart}&to=${setupEnd}`,
    ).then((r) => r.json());
    setBaseEntries(data.entries ?? []);
    if (data.shifts) setShifts(data.shifts);
    if (data.employees) setEmployees(data.employees);
  }, [setupStart, setupEnd]);

  useEffect(() => {
    void refreshStatus().catch((e) =>
      setMessage(e instanceof Error ? e.message : "Laden fehlgeschlagen"),
    );
  }, [refreshStatus]);

  useEffect(() => {
    if (step === "competencies") void loadCompetencies();
    if (step === "shifts") {
      void loadCompetencies();
      void loadShifts();
    }
    if (step === "employees") {
      void loadCompetencies();
      void loadEmployees();
    }
    if (step === "schedule" || step === "apply") {
      void loadBase();
      void loadEmployees();
      void loadShifts();
    }
  }, [step, loadCompetencies, loadShifts, loadEmployees, loadBase]);

  async function goTo(next: StepId) {
    setBusy(true);
    setMessage(null);
    try {
      await apiSend("/api/onboarding", "POST", { action: "step", step: next });
      setStep(next);
      await refreshStatus();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Schritt fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function addCompetency(e: FormEvent) {
    e.preventDefault();
    if (!compName.trim()) return;
    setBusy(true);
    try {
      await apiSend("/api/competencies", "POST", {
        name: compName.trim(),
        color: compColor,
      });
      setCompName("");
      await loadCompetencies();
      await refreshStatus();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function removeCompetency(id: string) {
    if (!confirm("Kompetenz löschen?")) return;
    await fetch(`/api/competencies/${id}`, { method: "DELETE" });
    await loadCompetencies();
    await refreshStatus();
  }

  async function addShift(e: FormEvent) {
    e.preventDefault();
    if (!shiftName.trim()) return;
    setBusy(true);
    try {
      await apiSend("/api/shifts", "POST", {
        name: shiftName.trim(),
        startTime: shiftStart,
        endTime: shiftEnd,
        color: shiftColor,
        kind: shiftKind,
        sortOrder: shifts.length + 1,
        requirements: competencies.map((c) => ({
          competencyId: c.id,
          minCount: reqCounts[c.id] ?? 0,
        })),
      });
      setShiftName("");
      setReqCounts({});
      await loadShifts();
      await refreshStatus();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function removeShift(id: string) {
    if (!confirm("Schicht löschen?")) return;
    await fetch(`/api/shifts/${id}`, { method: "DELETE" });
    await loadShifts();
    await refreshStatus();
  }

  async function addEmployee(e: FormEvent) {
    e.preventDefault();
    if (!empName.trim()) return;
    setBusy(true);
    try {
      await apiSend("/api/employees", "POST", {
        name: empName.trim(),
        shiftPreference: empPref,
        dutyModel: empModel,
        employmentType: empModel === "WEEKDAYS" ? "PART_TIME" : "FULL_TIME",
        competencyIds: empComps,
        dutyCycleStartDate: setupStart,
      });
      setEmpName("");
      setEmpComps([]);
      await loadEmployees();
      await refreshStatus();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function removeEmployee(id: string) {
    if (!confirm("Mitarbeiter löschen?")) return;
    await fetch(`/api/employees/${id}`, { method: "DELETE" });
    await loadEmployees();
    await refreshStatus();
  }

  async function addBaseEntry(day: string, shiftId: string) {
    if (!pickEmp) return;
    setBusy(true);
    try {
      await apiSend("/api/base-schedule", "POST", {
        date: day,
        employeeId: pickEmp,
        shiftTemplateId: shiftId,
        force: true,
      });
      setAdding(null);
      await loadBase();
      await refreshStatus();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Eintrag fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function removeBaseEntry(id: string) {
    await apiSend(`/api/base-schedule/${id}`, "DELETE");
    await loadBase();
    await refreshStatus();
  }

  async function applyAndFinish() {
    setBusy(true);
    setMessage(null);
    try {
      const applied = await apiSend<{
        updated: number;
        warnings: string[];
      }>("/api/base-schedule", "POST", {
        action: "apply",
        startDate: setupStart,
      });
      await apiSend("/api/onboarding", "POST", { action: "complete" });
      setMessage(
        `Einrichtung abgeschlossen. ${applied.updated} Dienstmodelle gesetzt.` +
          (applied.warnings?.length
            ? ` Hinweise: ${applied.warnings.slice(0, 2).join(" | ")}`
            : ""),
      );
      router.replace("/dienstplan");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Abschluss fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  function canNext(): boolean {
    if (!status) return false;
    if (step === "welcome") return true;
    if (step === "competencies") return status.canProceed.competencies;
    if (step === "shifts") return status.canProceed.shifts;
    if (step === "employees") return status.canProceed.employees;
    if (step === "schedule") return status.canProceed.schedule;
    return true;
  }

  function nextStep() {
    const i = stepIndex;
    if (i < 0 || i >= STEPS.length - 1) return;
    void goTo(STEPS[i + 1].id);
  }

  function prevStep() {
    const i = stepIndex;
    if (i <= 0) return;
    void goTo(STEPS[i - 1].id);
  }

  if (!status) {
    return <EmptyState text="Setup wird geladen…" />;
  }

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          Willkommen bei Schichtwerk
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          Richten Sie Kompetenzen, Schichten, Mitarbeiter und Ihren bestehenden
          2-Wochen-Dienstplan ein. Danach steht die volle Anwendung bereit.
        </p>
      </div>

      <ol className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <li
            key={s.id}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              i === stepIndex
                ? "bg-[var(--accent)] text-white"
                : i < stepIndex
                  ? "bg-[var(--surface-2)] text-[var(--ink)]"
                  : "bg-white text-[var(--muted)] border border-[var(--line)]"
            }`}
          >
            {i + 1}. {s.label}
          </li>
        ))}
      </ol>

      {message ? (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      {step === "welcome" ? (
        <Panel>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">
            Ersteinrichtung
          </h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--ink-soft)]">
            <li>Kompetenzen anlegen (z. B. NSC, A1, SYS)</li>
            <li>Schichten mit Sollbesetzung definieren</li>
            <li>Mitarbeiter inkl. Dienstmodell erfassen</li>
            <li>Bestehenden 2-Wochen-Plan als Startpunkt eintragen</li>
            <li>Rotation daraus ableiten und fertig</li>
          </ul>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Die Daten bleiben lokal auf diesem Computer.
          </p>
        </Panel>
      ) : null}

      {step === "competencies" ? (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Panel>
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">
              Kompetenz hinzufügen
            </h2>
            <form onSubmit={addCompetency} className="space-y-3">
              <Input
                label="Name"
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
                required
              />
              <Input
                label="Farbe"
                type="color"
                value={compColor}
                onChange={(e) => setCompColor(e.target.value)}
              />
              <Button type="submit" disabled={busy}>
                Speichern
              </Button>
            </form>
          </Panel>
          <Panel>
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">
              Vorhanden ({competencies.length})
            </h2>
            {competencies.length === 0 ? (
              <EmptyState text="Noch keine Kompetenzen – mindestens eine anlegen." />
            ) : (
              <ul className="space-y-2">
                {competencies.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between rounded-md border border-[var(--line)] px-3 py-2"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      {c.name}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-[var(--danger)]"
                      onClick={() => void removeCompetency(c.id)}
                    >
                      Löschen
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      ) : null}

      {step === "shifts" ? (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Panel>
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">
              Schicht hinzufügen
            </h2>
            <form onSubmit={addShift} className="space-y-3">
              <Input
                label="Name"
                value={shiftName}
                onChange={(e) => setShiftName(e.target.value)}
                placeholder="Frühschicht"
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Beginn"
                  type="time"
                  value={shiftStart}
                  onChange={(e) => setShiftStart(e.target.value)}
                />
                <Input
                  label="Ende"
                  type="time"
                  value={shiftEnd}
                  onChange={(e) => setShiftEnd(e.target.value)}
                />
              </div>
              <Select
                label="Art"
                value={shiftKind}
                onChange={(e) => setShiftKind(e.target.value as ShiftKind)}
              >
                <option value="DAY">Tag</option>
                <option value="NIGHT">Nacht</option>
                <option value="INTERMEDIATE">Zwischendienst</option>
              </Select>
              <Input
                label="Farbe"
                type="color"
                value={shiftColor}
                onChange={(e) => setShiftColor(e.target.value)}
              />
              <div className="space-y-2">
                <div className="text-sm font-medium">Sollbesetzung</div>
                {competencies.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{c.name}</span>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      className="w-16 rounded border border-[var(--line)] px-2 py-1"
                      value={reqCounts[c.id] ?? 0}
                      onChange={(e) =>
                        setReqCounts((prev) => ({
                          ...prev,
                          [c.id]: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
              <Button type="submit" disabled={busy || competencies.length === 0}>
                Speichern
              </Button>
            </form>
          </Panel>
          <Panel>
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">
              Vorhanden ({shifts.length})
            </h2>
            {shifts.length === 0 ? (
              <EmptyState text="Noch keine Schichten – z. B. Früh- und Nachtschicht anlegen." />
            ) : (
              <ul className="space-y-2">
                {shifts.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-start justify-between gap-2 rounded-md border border-[var(--line)] px-3 py-2"
                  >
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {s.startTime}–{s.endTime} · {s.kind}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-[var(--danger)]"
                      onClick={() => void removeShift(s.id)}
                    >
                      Löschen
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      ) : null}

      {step === "employees" ? (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Panel>
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">
              Mitarbeiter hinzufügen
            </h2>
            <form onSubmit={addEmployee} className="space-y-3">
              <Input
                label="Name"
                value={empName}
                onChange={(e) => setEmpName(e.target.value)}
                required
              />
              <Select
                label="Dienstmodell"
                value={empModel}
                onChange={(e) => setEmpModel(e.target.value)}
              >
                <option value="ROTATION_4_4">4/4 Wechsel</option>
                <option value="WEEKDAYS">Mo–Fr Teilzeit</option>
              </Select>
              <Select
                label="Schichtpräferenz"
                value={empPref}
                onChange={(e) => setEmpPref(e.target.value)}
              >
                <option value="ANY">Egal</option>
                <option value="DAY_ONLY">Nur Tag</option>
                <option value="NIGHT_ONLY">Nur Nacht</option>
              </Select>
              <div className="space-y-1">
                <div className="text-sm font-medium">Kompetenzen</div>
                {competencies.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={empComps.includes(c.id)}
                      onChange={(e) => {
                        setEmpComps((prev) =>
                          e.target.checked
                            ? [...prev, c.id]
                            : prev.filter((id) => id !== c.id),
                        );
                      }}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
              <Button type="submit" disabled={busy}>
                Speichern
              </Button>
            </form>
          </Panel>
          <Panel>
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">
              Vorhanden ({employees.length})
            </h2>
            {employees.length === 0 ? (
              <EmptyState text="Noch keine Mitarbeiter." />
            ) : (
              <ul className="space-y-2">
                {employees.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-start justify-between gap-2 rounded-md border border-[var(--line)] px-3 py-2"
                  >
                    <div>
                      <div className="font-medium">{e.name}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {e.dutyModel} · {e.shiftPreference}
                        {e.competencies?.length
                          ? ` · ${e.competencies.map((c) => c.competency.name).join(", ")}`
                          : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-[var(--danger)]"
                      onClick={() => void removeEmployee(e.id)}
                    >
                      Löschen
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      ) : null}

      {step === "schedule" ? (
        <div className="space-y-4">
          <Panel>
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <label className="text-sm text-[var(--muted)]">
                Setup-Start (2 Wochen)
                <input
                  type="date"
                  className="mt-1 block rounded-md border border-[var(--line)] bg-white px-2 py-1.5"
                  value={setupStart}
                  onChange={(e) => setSetupStart(e.target.value)}
                  onBlur={() => void loadBase()}
                />
              </label>
              <p className="pb-1.5 text-sm text-[var(--muted)]">
                {formatDateRange(setupStart, 14)} · {baseEntries.length} Einträge
              </p>
            </div>
            <p className="mb-4 text-sm text-[var(--ink-soft)]">
              Tragen Sie hier Ihren bestehenden Dienstplan für zwei Wochen ein.
              Das ist der Startpunkt für die spätere Rotation.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-[var(--line)] p-2 text-left">Schicht</th>
                    {setupDays.map((d) => (
                      <th key={d} className="border-b border-[var(--line)] p-2 text-left text-xs">
                        {format(parseISO(d), "EEE dd.MM.", { locale: de })}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((shift) => (
                    <tr key={shift.id}>
                      <td className="border-b border-[var(--line)] p-2 align-top">
                        <div className="font-medium">{shift.name}</div>
                        <div className="text-xs text-[var(--muted)]">
                          {shift.startTime}–{shift.endTime}
                        </div>
                      </td>
                      {setupDays.map((day) => {
                        const list = baseEntries.filter(
                          (e) => e.date === day && e.shiftTemplateId === shift.id,
                        );
                        const cellKey = `${day}|${shift.id}`;
                        return (
                          <td key={cellKey} className="border-b border-[var(--line)] p-1 align-top">
                            <div className="space-y-1">
                              {list.map((e) => (
                                <div
                                  key={e.id}
                                  className="flex items-center justify-between gap-1 rounded px-1.5 py-1 text-[10px] text-white"
                                  style={{ backgroundColor: shift.color }}
                                >
                                  <span className="truncate">{e.employee.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => void removeBaseEntry(e.id)}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                              {adding === cellKey ? (
                                <div className="space-y-1">
                                  <select
                                    className="w-full rounded border px-1 text-xs"
                                    value={pickEmp}
                                    onChange={(e) => setPickEmp(e.target.value)}
                                  >
                                    <option value="">…</option>
                                    {employees.map((emp) => (
                                      <option key={emp.id} value={emp.id}>
                                        {emp.name}
                                      </option>
                                    ))}
                                  </select>
                                  <Button
                                    className="!px-2 !py-0.5 text-xs"
                                    disabled={busy}
                                    onClick={() => void addBaseEntry(day, shift.id)}
                                  >
                                    OK
                                  </Button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="text-[10px] text-[var(--accent)]"
                                  onClick={() => setAdding(cellKey)}
                                >
                                  +
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
            </div>
          </Panel>
        </div>
      ) : null}

      {step === "apply" ? (
        <Panel>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">
            Einrichtung abschließen
          </h2>
          <ul className="mb-4 space-y-1 text-sm text-[var(--ink-soft)]">
            <li>Kompetenzen: {status.counts.competencies}</li>
            <li>Schichten: {status.counts.shifts}</li>
            <li>Mitarbeiter: {status.counts.employees}</li>
            <li>Setup-Einträge (2 Wochen): {status.counts.baseEntries}</li>
          </ul>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Beim Abschluss werden aus dem 2-Wochen-Plan die Dienstmodelle
            (Zyklusstart, Tag/Nacht) abgeleitet. Danach können Sie unter
            Dienstplan weitere Wochen generieren.
          </p>
          <Button
            disabled={
              busy ||
              !status.canProceed.competencies ||
              !status.canProceed.shifts ||
              !status.canProceed.employees
            }
            onClick={() => void applyAndFinish()}
          >
            Setup abschließen und App öffnen
          </Button>
          {!status.canProceed.schedule ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Hinweis: Noch keine Setup-Einträge – Sie können trotzdem abschließen
              und den Plan später unter Ursprungsplan nachtragen.
            </p>
          ) : null}
        </Panel>
      ) : null}

      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="secondary" disabled={busy || stepIndex <= 0} onClick={prevStep}>
          Zurück
        </Button>
        {step !== "apply" ? (
          <Button disabled={busy || !canNext()} onClick={nextStep}>
            Weiter
          </Button>
        ) : null}
      </div>
    </div>
  );
}
