import {
  addDays,
  differenceInCalendarDays,
  getISODay,
  getISOWeek,
  getMonth,
  getYear,
  startOfDay,
} from "date-fns";

/** Gesetzliche Mindestruhezeit zwischen zwei Diensten (Stunden). */
export const MIN_REST_HOURS = 12;

export type DutyModel = "ROTATION_4_4" | "WEEKDAYS" | "CUSTOM";
export type EmploymentType = "FULL_TIME" | "PART_TIME";
export type ShiftKind = "DAY" | "NIGHT" | "INTERMEDIATE";

export type DutyModelConfig = {
  employmentType: EmploymentType;
  dutyModel: DutyModel;
  dutyOnDays: number;
  dutyOffDays: number;
  dutyCycleStartDate: Date | null;
  allowFifthShiftPerMonth: boolean;
  partTimeStartTime: string;
  partTimeEndTime: string;
  workWeekdays: string;
  allowIntermediateShifts: boolean;
  defaultShiftTemplateId: string | null;
  maxShifts: number;
};

export type ShiftTimes = {
  startTime: string;
  endTime: string;
  kind: ShiftKind;
};

/** Parst "1,2,3,4,5" → Set von ISO-Wochentagen (1=Mo … 7=So). */
export function parseWorkWeekdays(value: string): Set<number> {
  return new Set(
    value
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => n >= 1 && n <= 7),
  );
}

/**
 * Ob der Mitarbeiter laut Dienstmodell an diesem Kalendertag Dienst hat
 * (4/4-Zyklus bzw. Mo–Fr / CUSTOM-Wochentage).
 */
export function isDutyDay(employee: DutyModelConfig, day: Date): boolean {
  const d = startOfDay(day);

  if (employee.dutyModel === "WEEKDAYS") {
    const days = parseWorkWeekdays(employee.workWeekdays || "1,2,3,4,5");
    return days.has(getISODay(d));
  }

  // ROTATION_4_4 und CUSTOM: on/off-Zyklus
  const on = Math.max(1, employee.dutyOnDays || 4);
  const off = Math.max(0, employee.dutyOffDays || 4);
  const cycle = on + off;
  if (cycle <= 0) return true;

  const reference = employee.dutyCycleStartDate
    ? startOfDay(employee.dutyCycleStartDate)
    : d;
  const daysSince = differenceInCalendarDays(d, reference);
  // Negative Offset: vor dem Referenzdatum rückwärts im Zyklus rechnen
  const pos = ((daysSince % cycle) + cycle) % cycle;
  return pos < on;
}

/**
 * Ob eine Schichtvorlage zum Dienstmodell des Mitarbeiters passt.
 * - Zwischendienste nur bei allowIntermediateShifts
 * - Teilzeit WEEKDAYS: bevorzugt passende Zeiten, sonst nur Intermediate wenn erlaubt
 */
export function shiftMatchesDutyModel(
  employee: DutyModelConfig,
  shift: ShiftTimes,
): boolean {
  if (shift.kind === "INTERMEDIATE") {
    return employee.allowIntermediateShifts;
  }

  if (employee.dutyModel === "WEEKDAYS") {
    // Standard-Teilzeitschicht: exakte Zeiten Mo–Fr 9–15
    if (
      shift.startTime === employee.partTimeStartTime &&
      shift.endTime === employee.partTimeEndTime
    ) {
      return true;
    }
    // Andere Tag-/Nachtschichten nur, wenn keine strikte Teilzeit-Zeit nötig –
    // Teilzeit ohne Intermediate bleibt auf ihre Kernzeiten beschränkt.
    return false;
  }

  return true;
}

/** Start- und Endzeitpunkt einer Schicht an einem Kalendertag. */
export function shiftDateTimeWindow(
  date: Date,
  startTime: string,
  endTime: string,
): { start: Date; end: Date } {
  const day = startOfDay(date);
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const start = new Date(day);
  start.setHours(sh, sm, 0, 0);
  const end = new Date(day);
  end.setHours(eh, em, 0, 0);
  if (end.getTime() <= start.getTime()) {
    end.setDate(end.getDate() + 1);
  }
  return { start, end };
}

/** Mindestruhezeit zwischen Ende des einen und Beginn des nächsten Dienstes. */
export function respectsMinRest(
  previousEnd: Date | null | undefined,
  nextStart: Date,
  minHours: number = MIN_REST_HOURS,
): boolean {
  if (!previousEnd) return true;
  const minMs = minHours * 60 * 60 * 1000;
  return nextStart.getTime() - previousEnd.getTime() >= minMs;
}

export function weekKey(day: Date): string {
  const d = startOfDay(day);
  return `${getYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
}

export function monthKey(day: Date): string {
  const d = startOfDay(day);
  return `${getYear(d)}-${String(getMonth(d) + 1).padStart(2, "0")}`;
}

/**
 * Prüft, ob ein weiterer Dienst in dieser ISO-Woche erlaubt ist.
 * Vollzeit mit Überstundenpauschale: normal max. 4/Woche, einmal im Monat 5.
 */
export function canTakeAnotherShiftThisWeek(
  employee: DutyModelConfig,
  day: Date,
  shiftsThisWeek: number,
  /** Wochen-Keys in diesem Monat, in denen bereits 5 Dienste erreicht wurden */
  fifthShiftWeeksUsedInMonth: Set<string>,
): boolean {
  const wk = weekKey(day);
  const mk = monthKey(day);

  // Teilzeit: maxShifts als Wochenlimit
  if (employee.employmentType === "PART_TIME" || employee.dutyModel === "WEEKDAYS") {
    return shiftsThisWeek < Math.max(1, employee.maxShifts);
  }

  // Vollzeit 4/4: normalerweise max. 4 Dienste/Woche
  const normalMax = Math.min(4, Math.max(1, employee.maxShifts));
  if (shiftsThisWeek < normalMax) return true;

  // Einmal pro Monat: 5. Dienst in einer Woche (Überstundenpauschale)
  if (
    employee.allowFifthShiftPerMonth &&
    shiftsThisWeek < 5 &&
    shiftsThisWeek >= normalMax
  ) {
    // Schon eine andere Woche in diesem Monat mit 5 Diensten?
    for (const used of fifthShiftWeeksUsedInMonth) {
      if (used.startsWith(mk + "|") && used !== `${mk}|${wk}`) {
        return false;
      }
    }
    return true;
  }

  return false;
}

/** Markiert, dass in dieser Woche der 5. Dienst genutzt wurde. */
export function markFifthShiftWeek(
  day: Date,
  shiftsThisWeekAfter: number,
  fifthShiftWeeksUsedInMonth: Set<string>,
) {
  if (shiftsThisWeekAfter >= 5) {
    fifthShiftWeeksUsedInMonth.add(`${monthKey(day)}|${weekKey(day)}`);
  }
}

/**
 * Vorschlag: welche Schichtvorlage für diesen Mitarbeiter an diesem Tag
 * laut Dienstmodell am besten passt (für Ursprungsplan-Generierung).
 */
export function preferredShiftForEmployee<
  T extends ShiftTimes & { id: string },
>(
  employee: DutyModelConfig & {
    shiftPreference?: "ANY" | "DAY_ONLY" | "NIGHT_ONLY" | "ROTATING";
    rotationWeeks?: number;
    rotationStartDate?: Date | null;
    rotationStartKind?: ShiftKind;
  },
  shifts: T[],
  day?: Date,
): T | null {
  const allowed = shifts.filter((s) => shiftMatchesDutyModel(employee, s));
  if (allowed.length === 0) return null;

  if (employee.defaultShiftTemplateId) {
    const preferred = allowed.find((s) => s.id === employee.defaultShiftTemplateId);
    if (preferred) return preferred;
  }

  if (employee.dutyModel === "WEEKDAYS") {
    const match = allowed.find(
      (s) =>
        s.startTime === employee.partTimeStartTime &&
        s.endTime === employee.partTimeEndTime,
    );
    if (match) return match;
    return allowed[0] ?? null;
  }

  // Tag-/Nacht-Präferenz (Rotation nur wenn Tag übergeben)
  let kindFilter: ShiftKind | null = null;
  if (employee.shiftPreference === "DAY_ONLY") kindFilter = "DAY";
  if (employee.shiftPreference === "NIGHT_ONLY") kindFilter = "NIGHT";
  if (employee.shiftPreference === "ROTATING" && day) {
    const weeks = Math.max(1, employee.rotationWeeks || 1);
    const reference = employee.rotationStartDate
      ? startOfDay(employee.rotationStartDate)
      : startOfDay(day);
    const daysSince = Math.max(
      0,
      differenceInCalendarDays(startOfDay(day), reference),
    );
    const periodIndex = Math.floor(daysSince / (weeks * 7));
    const startKind: ShiftKind =
      employee.rotationStartKind === "NIGHT" ? "NIGHT" : "DAY";
    kindFilter =
      periodIndex % 2 === 0
        ? startKind
        : startKind === "DAY"
          ? "NIGHT"
          : "DAY";
  }

  if (kindFilter) {
    const match = allowed.find((s) => s.kind === kindFilter);
    if (match) return match;
  }

  const dayShift = allowed.find((s) => s.kind === "DAY");
  return dayShift ?? allowed[0] ?? null;
}

export function dutyModelLabel(model: DutyModel): string {
  switch (model) {
    case "ROTATION_4_4":
      return "4 Tage Dienst / 4 Tage frei";
    case "WEEKDAYS":
      return "Mo–Fr (Teilzeit)";
    case "CUSTOM":
      return "Individuell (Dienst/Frei-Zyklus)";
    default:
      return model;
  }
}

/** Nützlicher Export für Tests: nächster freier Tag nach einem Dienstende + Ruhezeit. */
export function earliestNextStart(
  previousEnd: Date,
  minHours: number = MIN_REST_HOURS,
): Date {
  return new Date(previousEnd.getTime() + minHours * 60 * 60 * 1000);
}

export function addCalendarDays(day: Date, n: number): Date {
  return addDays(startOfDay(day), n);
}
