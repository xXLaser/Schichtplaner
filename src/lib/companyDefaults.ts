/** Standard-Schichtsystem: Tag 6–18, Nacht 18–6, Teamleiter-Zwischendienst 9h, Teilzeit tags. */

export const COMPANY_SHIFT_TEMPLATES = [
  {
    name: "Tagschicht",
    startTime: "06:00",
    endTime: "18:00",
    kind: "DAY" as const,
    color: "#0f766e",
    sortOrder: 1,
    requirements: [
      { competencyName: "Schichtleitung", minCount: 1 },
      { competencyName: "Maschinenführung", minCount: 2 },
      { competencyName: "Qualitätssicherung", minCount: 1 },
      { competencyName: "Teilzeit", minCount: 1 },
    ],
  },
  {
    name: "Nachtschicht",
    startTime: "18:00",
    endTime: "06:00",
    kind: "NIGHT" as const,
    color: "#1e3a5f",
    sortOrder: 2,
    requirements: [
      { competencyName: "Schichtleitung", minCount: 1 },
      { competencyName: "Maschinenführung", minCount: 2 },
      { competencyName: "Qualitätssicherung", minCount: 1 },
    ],
  },
  {
    name: "Teamleiter Zwischendienst",
    startTime: "09:00",
    endTime: "18:00",
    kind: "INTERMEDIATE" as const,
    color: "#b45309",
    sortOrder: 3,
    requirements: [{ competencyName: "Teamleitung", minCount: 1 }],
  },
  {
    name: "Teilzeit",
    startTime: "09:00",
    endTime: "15:00",
    kind: "DAY" as const,
    color: "#7c3aed",
    sortOrder: 4,
    requirements: [{ competencyName: "Teilzeit", minCount: 1 }],
  },
] as const;

export const COMPANY_COMPETENCIES = [
  { name: "Schichtleitung", color: "#0f766e", description: "Verantwortlich für die Schicht" },
  { name: "Teamleitung", color: "#b45309", description: "Teamleiter zwischen den Schichten (9h)" },
  { name: "Maschinenführung", color: "#0369a1", description: "Bedienung der Hauptanlagen" },
  { name: "Qualitätssicherung", color: "#ca8a04", description: "Prüfung und Dokumentation" },
  { name: "Teilzeit", color: "#7c3aed", description: "Teilzeitkraft tagsüber" },
  { name: "Logistik", color: "#64748b", description: "Materialfluss" },
] as const;

/** Mindestruhezeit für Teamleiter (9h zwischen Schichten). */
export const TEAM_LEADER_REST_HOURS = 9;

/** Standard-Ruhezeit für reguläre Mitarbeiter. */
export const DEFAULT_REST_HOURS = 12;
