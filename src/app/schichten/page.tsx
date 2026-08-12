"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  PageHeader,
  Panel,
  Button,
  Input,
  EmptyState,
} from "@/components/ui";

type Competency = { id: string; name: string; color: string };
type Requirement = {
  competencyId: string;
  minCount: number;
  competency?: Competency;
};
type Shift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  active: boolean;
  sortOrder: number;
  requirements: Requirement[];
};

export default function SchichtenPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("14:00");
  const [color, setColor] = useState("#0f766e");
  const [sortOrder, setSortOrder] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [s, c] = await Promise.all([
      fetch("/api/shifts").then((r) => r.json()),
      fetch("/api/competencies").then((r) => r.json()),
    ]);
    setShifts(s);
    setCompetencies(c);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  function reset() {
    setEditing(null);
    setName("");
    setStartTime("06:00");
    setEndTime("14:00");
    setColor("#0f766e");
    setSortOrder(0);
    setCounts({});
  }

  function startEdit(shift: Shift) {
    setEditing(shift);
    setName(shift.name);
    setStartTime(shift.startTime);
    setEndTime(shift.endTime);
    setColor(shift.color);
    setSortOrder(shift.sortOrder);
    const map: Record<string, number> = {};
    for (const r of shift.requirements) {
      map[r.competencyId] = r.minCount;
    }
    setCounts(map);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const requirements = competencies.map((c) => ({
      competencyId: c.id,
      minCount: counts[c.id] ?? 0,
    }));
    const payload = { name, startTime, endTime, color, sortOrder, requirements };

    if (editing) {
      await fetch(`/api/shifts/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    reset();
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Schichtvorlage löschen?")) return;
    await fetch(`/api/shifts/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Schichten"
        subtitle="Pro Schicht einstellen, wie viele Personen mit welcher Kompetenz anwesend sein müssen."
      />

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Panel>
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-lg">
            {editing ? "Schicht bearbeiten" : "Neue Schicht"}
          </h2>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Beginn"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
              <Input
                label="Ende"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Farbe"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
              <Input
                label="Reihenfolge"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
              />
            </div>

            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/40 p-3">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Mindestanzahl je Kompetenz
              </p>
              <div className="space-y-2">
                {competencies.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      {c.name}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      className="w-20 rounded-md border border-[var(--line)] bg-white px-2 py-1 text-sm"
                      value={counts[c.id] ?? 0}
                      onChange={(e) =>
                        setCounts((prev) => ({
                          ...prev,
                          [c.id]: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                ))}
                {competencies.length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">
                    Zuerst Kompetenzen anlegen.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit">{editing ? "Speichern" : "Anlegen"}</Button>
              {editing ? (
                <Button type="button" variant="ghost" onClick={reset}>
                  Abbrechen
                </Button>
              ) : null}
            </div>
          </form>
        </Panel>

        <div className="space-y-3">
          {loading ? (
            <EmptyState text="Lade Schichten…" />
          ) : shifts.length === 0 ? (
            <EmptyState text="Noch keine Schichtvorlagen." />
          ) : (
            shifts.map((s) => (
              <Panel key={s.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      <h3 className="font-[family-name:var(--font-display)] text-lg">
                        {s.name}
                      </h3>
                    </div>
                    <p className="text-sm text-[var(--muted)]">
                      {s.startTime}–{s.endTime}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {s.requirements.length === 0 ? (
                        <span className="text-xs text-[var(--warn)]">
                          Keine Anforderungen
                        </span>
                      ) : (
                        s.requirements.map((r) => (
                          <span
                            key={r.competencyId}
                            className="rounded-md px-2 py-1 text-xs font-medium text-white"
                            style={{
                              backgroundColor: r.competency?.color ?? "#334155",
                            }}
                          >
                            {r.competency?.name}: mind. {r.minCount}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => startEdit(s)}>
                      Bearbeiten
                    </Button>
                    <Button variant="danger" onClick={() => remove(s.id)}>
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
