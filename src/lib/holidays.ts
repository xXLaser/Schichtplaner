import { addDays, format, startOfDay } from "date-fns";
import type { HolidayRegion } from "./appConfig";

export type Holiday = {
  date: string;
  name: string;
};

/** Gauß/Anonymous – Ostersonntag im gregorianischen Kalender. */
export function easterSunday(year: number): Date {
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
  return startOfDay(new Date(year, month - 1, day));
}

function iso(d: Date): string {
  return format(startOfDay(d), "yyyy-MM-dd");
}

function ymd(year: number, month: number, day: number): Date {
  return startOfDay(new Date(year, month - 1, day));
}

function austria(year: number): Holiday[] {
  const easter = easterSunday(year);
  return [
    { date: iso(ymd(year, 1, 1)), name: "Neujahr" },
    { date: iso(ymd(year, 1, 6)), name: "Heilige Drei Könige" },
    { date: iso(easter), name: "Ostersonntag" },
    { date: iso(addDays(easter, 1)), name: "Ostermontag" },
    { date: iso(ymd(year, 5, 1)), name: "Staatsfeiertag" },
    { date: iso(addDays(easter, 39)), name: "Christi Himmelfahrt" },
    { date: iso(addDays(easter, 50)), name: "Pfingstmontag" },
    { date: iso(addDays(easter, 60)), name: "Fronleichnam" },
    { date: iso(ymd(year, 8, 15)), name: "Mariä Himmelfahrt" },
    { date: iso(ymd(year, 10, 26)), name: "Nationalfeiertag" },
    { date: iso(ymd(year, 11, 1)), name: "Allerheiligen" },
    { date: iso(ymd(year, 12, 8)), name: "Mariä Empfängnis" },
    { date: iso(ymd(year, 12, 25)), name: "Christtag" },
    { date: iso(ymd(year, 12, 26)), name: "Stefanitag" },
  ];
}

function germany(year: number): Holiday[] {
  const easter = easterSunday(year);
  return [
    { date: iso(ymd(year, 1, 1)), name: "Neujahr" },
    { date: iso(easter), name: "Ostersonntag" },
    { date: iso(addDays(easter, 1)), name: "Ostermontag" },
    { date: iso(ymd(year, 5, 1)), name: "Tag der Arbeit" },
    { date: iso(addDays(easter, 39)), name: "Christi Himmelfahrt" },
    { date: iso(addDays(easter, 50)), name: "Pfingstmontag" },
    { date: iso(ymd(year, 10, 3)), name: "Tag der Deutschen Einheit" },
    { date: iso(ymd(year, 12, 25)), name: "1. Weihnachtsfeiertag" },
    { date: iso(ymd(year, 12, 26)), name: "2. Weihnachtsfeiertag" },
  ];
}

export function holidaysForYear(
  year: number,
  region: HolidayRegion = "AT",
): Holiday[] {
  return region === "DE" ? germany(year) : austria(year);
}

export function holidaysInRange(
  start: Date,
  end: Date,
  region: HolidayRegion = "AT",
): Holiday[] {
  const years = new Set<number>();
  years.add(start.getFullYear());
  years.add(end.getFullYear());
  const startKey = iso(start);
  const endKey = iso(end);
  const all: Holiday[] = [];
  for (const year of years) {
    for (const h of holidaysForYear(year, region)) {
      if (h.date >= startKey && h.date <= endKey) all.push(h);
    }
  }
  return all.sort((a, b) => a.date.localeCompare(b.date));
}

export function holidayMap(
  start: Date,
  end: Date,
  region: HolidayRegion = "AT",
): Map<string, Holiday> {
  return new Map(holidaysInRange(start, end, region).map((h) => [h.date, h]));
}
