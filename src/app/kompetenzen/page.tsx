"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  PageHeader,
  Panel,
  Button,
  Input,
  Textarea,
  EmptyState,
} from "@/components/ui";

type Competency = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  _count?: { employees: number; requirements: number };
};

export default function KompetenzenPage() {
  const [items, setItems] = useState<Competency[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#0f766e");
  const [editing, setEditing] = useState<Competency | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setItems(await fetch("/api/competencies").then((r) => r.json()));
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  function reset() {
    setEditing(null);
    setName("");
    setDescription("");
    setColor("#0f766e");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = { name, description: description || null, color };
    if (editing) {
      await fetch(`/api/competencies/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/competencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    reset();
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Kompetenz löschen?")) return;
    await fetch(`/api/competencies/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Kompetenzen"
        subtitle="Fähigkeiten, die in Schichten abgedeckt sein müssen – z. B. Schichtleitung oder Maschinenführung."
      />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Panel>
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-lg">
            {editing ? "Bearbeiten" : "Neue Kompetenz"}
          </h2>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Textarea
              label="Beschreibung"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Input
              label="Farbe"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
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

        <div className="grid gap-3 sm:grid-cols-2">
          {loading ? (
            <EmptyState text="Lade Kompetenzen…" />
          ) : items.length === 0 ? (
            <EmptyState text="Noch keine Kompetenzen." />
          ) : (
            items.map((c) => (
              <Panel key={c.id}>
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  <h3 className="font-[family-name:var(--font-display)] text-lg">
                    {c.name}
                  </h3>
                </div>
                <p className="mb-3 text-sm text-[var(--muted)]">
                  {c.description || "Keine Beschreibung"}
                </p>
                <p className="mb-3 text-xs text-[var(--ink-soft)]">
                  {c._count?.employees ?? 0} Mitarbeitende ·{" "}
                  {c._count?.requirements ?? 0} Schichtanforderungen
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditing(c);
                      setName(c.name);
                      setDescription(c.description ?? "");
                      setColor(c.color);
                    }}
                  >
                    Bearbeiten
                  </Button>
                  <Button variant="danger" onClick={() => remove(c.id)}>
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
