"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  PageHeader,
  Panel,
  Button,
  Input,
  Badge,
  EmptyState,
  ErrorBanner,
} from "@/components/ui";
import { apiGet, apiSend } from "@/lib/api";

type Competency = { id: string; name: string; color: string };
type Employee = {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
  maxShifts: number;
  vacationDaysPerYear: number;
  competencies: { competency: Competency }[];
};

export default function MitarbeiterPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [maxShifts, setMaxShifts] = useState(5);
  const [vacationDays, setVacationDays] = useState(30);
  const [selected, setSelected] = useState<string[]>([]);
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
  }

  function resetForm() {
    setEditing(null);
    setName("");
    setEmail("");
    setMaxShifts(5);
    setVacationDays(30);
    setSelected([]);
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

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Mitarbeiter"
        subtitle="Kompetenzen pro Person hinterlegen – der Planer setzt nur passende Leute ein."
      />

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
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
