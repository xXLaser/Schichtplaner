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
    admins: number;
    competencies: number;
    shifts: number;
    employees: number;
    baseEntries: number;
  };
  canProceed: {
    admin: boolean;
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
  role?: string;
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
  { id: "admin", label: "Admin" },
  { id: "options", label: "Optionen" },
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

  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminName, setAdminName] = useState("");

  const [dbMode, setDbMode] = useState<"sqlite" | "mysql">("sqlite");
  const [mysqlUrl, setMysqlUrl] = useState("");
  const [webAccess, setWebAccess] = useState(false);
  const [holidayRegion, setHolidayRegion] = useState("AT");

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
  const [empRole, setEmpRole] = useState("STAFF");
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
    if (json.step && STEPS.some((s) => s.id === json.step)) {
      setStep(json.step as StepId);
    }
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
    void fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        if (s.dbMode) setDbMode(s.dbMode);
        if (typeof s.webAccess === "boolean") setWebAccess(s.webAccess);
        if (s.holidayRegion) setHolidayRegion(s.holidayRegion);
      })
      .catch(() => undefined);
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

  async function createAdmin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await apiSend("/api/auth/admin", "POST", {
        username: adminUser,
        password: adminPass,
        displayName: adminName || undefined,
      });
      await refreshStatus();
      setMessage("Admin angelegt.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Admin fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function saveOptions() {
    setBusy(true);
    setMessage(null);
    try {
      await apiSend("/api/settings", "POST", {
        dbMode,
        mysqlUrl: dbMode === "mysql" ? mysqlUrl : undefined,
        webAccess,
        holidayRegion,
      });
      setMessage("Optionen gespeichert.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function applyCompanyPresets() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await apiSend<{ message: string }>("/api/presets/company", "POST", {});
      await loadCompetencies();
      await loadShifts();
      await refreshStatus();
      setMessage(res.message);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Preset fehlgeschlagen");
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
        role: empRole,
        allowIntermediateShifts: empRole === "TEAM_LEADER",
        competencyIds: empComps,
        dutyCycleStartDate: setupStart,
      });
      setEmpName("");
      setEmpComps([]);
      setEmpRole("STAFF");
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

  async function importPlanFile(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await apiSend<{
        created: number;
        skipped: number;
        warnings: string[];
      }>("/api/schedule/import", "POST", {
        payload,
        target: "base",
        replaceRange: true,
        createMissing: true,
      });
      await loadBase();
      await loadEmployees();
      await loadShifts();
      await refreshStatus();
      setMessage(
        `Import: ${res.created} Einträge` +
          (res.skipped ? `, ${res.skipped} übersprungen` : "") +
          ".",
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Import fehlgeschlagen");
    } finally {
      setBusy(false);
    }
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
    if (step === "admin") return status.canProceed.admin;
    if (step === "options") return true;
    if (step === "competencies") return status.canProceed.competencies;
    if (step === "shifts") return status.canProceed.shifts;
    if (step === "employees") return status.canProceed.employees;
    if (step === "schedule") return true;
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
          Ersteinrichtung: Admin, Optionen, Kompetenzen, Firmen-Schichten,
          Mitarbeiter und Ihr aktueller 2-Wochen-Dienstplan.
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
            <li>Admin-Benutzer für den lokalen Schutz anlegen</li>
            <li>SQLite (lokal) oder MySQL wählen; Web-Zugriff optional</li>
            <li>Firmen-Schichten: Tag 06–18, Nacht 18–06, Teamleiter 9h, Teilzeit</li>
            <li>Mitarbeiter inkl. Teamleiter / Teilzeit erfassen</li>
            <li>Bestehenden 2-Wochen-Plan eintragen oder importieren</li>
          </ul>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Danach planen Sie jeweils die nächsten zwei Wochen weiter und
            berücksichtigen Urlaub & Abwesenheiten.
          </p>
        </Panel>
      ) : null}

      {step === "admin" ? (
        <Panel>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">
            Admin-Benutzer
          </h2>
          {status.canProceed.admin ? (
            <p className="text-sm text-[var(--ok)]">
              Admin ist angelegt ({status.counts.admins}). Sie können weiter.
            </p>
          ) : (
            <form onSubmit={createAdmin} className="max-w-md space-y-3">
              <Input
                label="Anzeigename"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="z. B. Disponent"
              />
              <Input
                label="Benutzername"
                value={adminUser}
                onChange={(e) => setAdminUser(e.target.value)}
                required
                minLength={3}
              />
              <Input
                label="Passwort"
                type="password"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                required
                minLength={6}
              />
              <Button type="submit" disabled={busy}>
                Admin anlegen
              </Button>
            </form>
          )}
        </Panel>
      ) : null}

      {step === "options" ? (
        <Panel>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">
            Laufzeit-Optionen
          </h2>
          <div className="grid max-w-xl gap-3">
            <Select
              label="Datenbank"
              value={dbMode}
              onChange={(e) => setDbMode(e.target.value as "sqlite" | "mysql")}
            >
              <option value="sqlite">Onboard SQLite (empfohlen lokal)</option>
              <option value="mysql">Externe MySQL</option>
            </Select>
            {dbMode === "mysql" ? (
              <Input
                label="MySQL-URL"
                placeholder="mysql://user:pass@host:3306/schichtwerk"
                value={mysqlUrl}
                onChange={(e) => setMysqlUrl(e.target.value)}
              />
            ) : null}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={webAccess}
                onChange={(e) => setWebAccess(e.target.checked)}
              />
              <span>
                Web-Zugriff im LAN aktivieren
                <br />
                <span className="text-[var(--muted)]">
                  Standard aus: nur lokal. An: andere PCs im Netzwerk können
                  zugreifen.
                </span>
              </span>
            </label>
            <Select
              label="Feiertage"
              value={holidayRegion}
              onChange={(e) => setHolidayRegion(e.target.value)}
            >
              <option value="AT">Österreich</option>
              <option value="DE">Deutschland</option>
              <option value="DE-BY">Deutschland – Bayern</option>
              <option value="NONE">Keine</option>
            </Select>
            <Button type="button" disabled={busy} onClick={() => void saveOptions()}>
              Optionen speichern
            </Button>
          </div>
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
            <Button
              className="mt-3"
              variant="secondary"
              disabled={busy}
              onClick={() => void applyCompanyPresets()}
            >
              Firmen-Vorlage laden
            </Button>
          </Panel>
          <Panel>
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">
              Vorhanden ({competencies.length})
            </h2>
            {competencies.length === 0 ? (
              <EmptyState text="Noch keine Kompetenzen – Vorlage laden oder manuell anlegen." />
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
        <div className="space-y-4">
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-lg">
                  Firmen-Schichtsystem
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  Tag 06–18 · Nacht 18–06 · Teamleiter 09–18 (9h) · Teilzeit 09–15
                </p>
              </div>
              <Button disabled={busy} onClick={() => void applyCompanyPresets()}>
                Schichten übernehmen
              </Button>
            </div>
          </Panel>
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
                  placeholder="Tagschicht"
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
                  <option value="INTERMEDIATE">Zwischendienst / Teamleiter</option>
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
                <EmptyState text="Noch keine Schichten – Firmenvorlage übernehmen." />
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
                label="Rolle"
                value={empRole}
                onChange={(e) => setEmpRole(e.target.value)}
              >
                <option value="STAFF">Mitarbeiter</option>
                <option value="TEAM_LEADER">Teamleiter (9h Zwischendienst)</option>
              </Select>
              <Select
                label="Dienstmodell"
                value={empModel}
                onChange={(e) => setEmpModel(e.target.value)}
              >
                <option value="ROTATION_4_4">4/4 Wechsel (Vollzeit)</option>
                <option value="WEEKDAYS">Mo–Fr Teilzeit (untertags)</option>
              </Select>
              <Select
                label="Schichtpräferenz"
                value={empPref}
                onChange={(e) => setEmpPref(e.target.value)}
              >
                <option value="ANY">Egal</option>
                <option value="DAY_ONLY">Nur Tag</option>
                <option value="NIGHT_ONLY">Nur Nacht</option>
                <option value="ROTATING">Wechselnd</option>
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
                        {e.role === "TEAM_LEADER" ? "Teamleiter · " : ""}
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
              <label className="pb-1.5 text-sm">
                <span className="mr-2 text-[var(--muted)]">JSON importieren</span>
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void importPlanFile(f);
                  }}
                />
              </label>
            </div>
            <p className="mb-4 text-sm text-[var(--ink-soft)]">
              Tragen Sie Ihren aktuellen Dienstplan für zwei Wochen ein – oder
              importieren Sie einen zuvor exportierten Plan.
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
            <li>Admin: {status.counts.admins}</li>
            <li>Kompetenzen: {status.counts.competencies}</li>
            <li>Schichten: {status.counts.shifts}</li>
            <li>Mitarbeiter: {status.counts.employees}</li>
            <li>Setup-Einträge (2 Wochen): {status.counts.baseEntries}</li>
          </ul>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Beim Abschluss werden aus dem 2-Wochen-Plan die Dienstmodelle
            abgeleitet. Danach generieren Sie unter Dienstplan die nächsten
            Wochen und pflegen Urlaub.
          </p>
          <Button
            disabled={
              busy ||
              !status.canProceed.admin ||
              !status.canProceed.competencies ||
              !status.canProceed.shifts ||
              !status.canProceed.employees
            }
            onClick={() => void applyAndFinish()}
          >
            Setup abschließen und App öffnen
          </Button>
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
