import { addDays, format, getISODay } from "date-fns";
import type { HolidayRegion } from "./runtime-config";

export type Holiday = {
  date: string; // yyyy-MM-dd
  name: string;
};

/** Ostersonntag (Anonymous Gregorian algorithm). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function iso(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function fixed(year: number, month: number, day: number, name: string): Holiday {
  return { date: iso(new Date(year, month - 1, day)), name };
}

/** Bundesweite AT-Feiertage. */
function austriaHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  return [
    fixed(year, 1, 1, "Neujahr"),
    fixed(year, 1, 6, "Heilige Drei Könige"),
    { date: iso(easter), name: "Ostersonntag" },
    { date: iso(addDays(easter, 1)), name: "Ostermontag" },
    fixed(year, 5, 1, "Staatsfeiertag"),
    { date: iso(addDays(easter, 39)), name: "Christi Himmelfahrt" },
    { date: iso(addDays(easter, 49)), name: "Pfingstsonntag" },
    { date: iso(addDays(easter, 50)), name: "Pfingstmontag" },
    { date: iso(addDays(easter, 60)), name: "Fronleichnam" },
    fixed(year, 8, 15, "Mariä Himmelfahrt"),
    fixed(year, 10, 26, "Nationalfeiertag"),
    fixed(year, 11, 1, "Allerheiligen"),
    fixed(year, 12, 8, "Mariä Empfängnis"),
    fixed(year, 12, 25, "Christtag"),
    fixed(year, 12, 26, "Stefanitag"),
  ];
}

/** Deutschland bundesweit (+ optional Bayern). */
function germanyHolidays(year: number, bavaria: boolean): Holiday[] {
  const easter = easterSunday(year);
  const list: Holiday[] = [
    fixed(year, 1, 1, "Neujahr"),
    { date: iso(addDays(easter, -2)), name: "Karfreitag" },
    { date: iso(easter), name: "Ostersonntag" },
    { date: iso(addDays(easter, 1)), name: "Ostermontag" },
    fixed(year, 5, 1, "Tag der Arbeit"),
    { date: iso(addDays(easter, 39)), name: "Christi Himmelfahrt" },
    { date: iso(addDays(easter, 50)), name: "Pfingstmontag" },
    fixed(year, 10, 3, "Tag der Deutschen Einheit"),
    fixed(year, 12, 25, "1. Weihnachtstag"),
    fixed(year, 12, 26, "2. Weihnachtstag"),
  ];
  if (bavaria) {
    list.push(
      fixed(year, 1, 6, "Heilige Drei Könige"),
      { date: iso(addDays(easter, 60)), name: "Fronleichnam" },
      fixed(year, 8, 15, "Mariä Himmelfahrt"),
      fixed(year, 11, 1, "Allerheiligen"),
    );
  }
  return list;
}

export function holidaysForYear(year: number, region: HolidayRegion): Holiday[] {
  if (region === "NONE") return [];
  if (region === "AT") return austriaHolidays(year);
  if (region === "DE-BY") return germanyHolidays(year, true);
  return germanyHolidays(year, false);
}

export function holidaysInRange(
  fromIso: string,
  toIso: string,
  region: HolidayRegion,
): Holiday[] {
  if (region === "NONE") return [];
  const fromYear = Number(fromIso.slice(0, 4));
  const toYear = Number(toIso.slice(0, 4));
  const all: Holiday[] = [];
  for (let y = fromYear; y <= toYear; y += 1) {
    all.push(...holidaysForYear(y, region));
  }
  const map = new Map<string, Holiday>();
  for (const h of all) {
    if (h.date >= fromIso && h.date <= toIso) map.set(h.date, h);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function isWeekend(dateIso: string): boolean {
  const day = getISODay(new Date(dateIso + "T12:00:00"));
  return day >= 6;
}
