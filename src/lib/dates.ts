import { format, parseISO, startOfWeek, addDays } from "date-fns";
import { de } from "date-fns/locale";

export function weekStart(date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function formatDayLabel(iso: string): string {
  return format(parseISO(iso), "EEE dd.MM.", { locale: de });
}

export function formatWeekRange(startIso: string): string {
  const start = parseISO(startIso);
  const end = addDays(start, 6);
  return `${format(start, "dd.MM.", { locale: de })} – ${format(end, "dd.MM.yyyy", { locale: de })}`;
}

export const ABSENCE_LABELS: Record<string, string> = {
  VACATION: "Urlaub",
  SICK: "Krankenstand",
  OTHER: "Sonstiges",
};
