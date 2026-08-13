import { addDays, getDay, getYear, parseISO, startOfDay } from "date-fns";

/** Ostersonntag (Gregorianischer Kalender, Gauß-Algorithmus). */
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

function fixedHoliday(year: number, month: number, day: number, name: string) {
  const d = new Date(year, month - 1, day);
  return { date: d, name };
}

function offsetHoliday(
  base: Date,
  offsetDays: number,
  name: string,
): { date: Date; name: string } {
  return { date: addDays(base, offsetDays), name };
}

/** Gesetzliche Feiertage in Deutschland (bundesweit). */
export function germanPublicHolidays(year: number): { date: Date; name: string }[] {
  const easter = easterSunday(year);
  const holidays = [
    fixedHoliday(year, 1, 1, "Neujahr"),
    offsetHoliday(easter, -2, "Karfreitag"),
    offsetHoliday(easter, 1, "Ostermontag"),
    fixedHoliday(year, 5, 1, "Tag der Arbeit"),
    offsetHoliday(easter, 39, "Christi Himmelfahrt"),
    offsetHoliday(easter, 50, "Pfingstmontag"),
    fixedHoliday(year, 10, 3, "Tag der Deutschen Einheit"),
    fixedHoliday(year, 12, 25, "1. Weihnachtstag"),
    fixedHoliday(year, 12, 26, "2. Weihnachtstag"),
  ];

  // Buß- und Bettag (nur Sachsen, als Hinweis optional – hier nicht)
  return holidays;
}

export type HolidayInfo = { date: string; name: string };

export function holidaysInRange(from: string, to: string): HolidayInfo[] {
  const start = startOfDay(parseISO(from));
  const end = startOfDay(parseISO(to));
  const years = new Set<number>();
  for (let y = getYear(start); y <= getYear(end) + 1; y++) {
    years.add(y);
  }

  const map = new Map<string, string>();
  for (const year of years) {
    for (const h of germanPublicHolidays(year)) {
      const key = h.date.toISOString().slice(0, 10);
      if (h.date >= start && h.date <= end) {
        map.set(key, h.name);
      }
    }
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, name]) => ({ date, name }));
}

export function isHoliday(dateStr: string, holidays: HolidayInfo[]): boolean {
  return holidays.some((h) => h.date === dateStr);
}

export function holidayName(
  dateStr: string,
  holidays: HolidayInfo[],
): string | null {
  return holidays.find((h) => h.date === dateStr)?.name ?? null;
}

/** Sonntag (ISO: 7) */
export function isSunday(dateStr: string): boolean {
  return getDay(parseISO(dateStr)) === 0;
}
