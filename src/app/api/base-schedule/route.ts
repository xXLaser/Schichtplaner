import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseISO, startOfDay, subDays, addDays, format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getBaseSchedule, suggestBaseSchedule } from "@/lib/baseSchedule";
import {
  applySetupToDutyModels,
  getSetup,
  importAssignmentsToSetup,
  setSetup,
} from "@/lib/scheduleSetup";
import {
  MIN_REST_HOURS,
  respectsMinRest,
  shiftDateTimeWindow,
} from "@/lib/dutyModel";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");
    if (!from || !to) {
      // Ohne Zeitraum: nur Setup-Meta liefern
      const setup = await getSetup();
      return NextResponse.json({ setup });
    }
    const data = await getBaseSchedule(from, to);
    return NextResponse.json(data);
  } catch (error) {
    return apiError(error, "Ursprungsdienstplan konnte nicht geladen werden");
  }
}

const createSchema = z.object({
  date: z.string(),
  shiftTemplateId: z.string().min(1),
  employeeId: z.string().min(1),
  note: z.string().optional().nullable(),
  force: z.boolean().optional(),
});

const suggestSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  replaceExisting: z.boolean().optional(),
  action: z.literal("suggest"),
});

const setupSchema = z.object({
  action: z.literal("setup"),
  startDate: z.string(),
});

const importSchema = z.object({
  action: z.literal("import"),
  startDate: z.string().optional(),
});

const applySchema = z.object({
  action: z.literal("apply"),
  startDate: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body?.action === "suggest") {
      const parsed = suggestSchema.parse(body);
      const result = await suggestBaseSchedule(parsed.startDate, parsed.endDate, {
        replaceExisting: parsed.replaceExisting ?? true,
      });
      return NextResponse.json(result);
    }

    if (body?.action === "setup") {
      const parsed = setupSchema.parse(body);
      const setup = await setSetup(parsed.startDate);
      return NextResponse.json({ setup });
    }

    if (body?.action === "import") {
      const parsed = importSchema.parse(body);
      const result = await importAssignmentsToSetup(parsed.startDate);
      return NextResponse.json(result);
    }

    if (body?.action === "apply") {
      const parsed = applySchema.parse(body);
      const result = await applySetupToDutyModels(parsed.startDate);
      return NextResponse.json(result);
    }

    const parsed = createSchema.parse(body);
    const date = startOfDay(parseISO(parsed.date));

    const shift = await prisma.shiftTemplate.findUnique({
      where: { id: parsed.shiftTemplateId },
    });
    if (!shift) {
      return NextResponse.json(
        { error: "Schichtvorlage nicht gefunden." },
        { status: 404 },
      );
    }

    if (!parsed.force) {
      const { start: nextStart, end: nextEnd } = shiftDateTimeWindow(
        date,
        shift.startTime,
        shift.endTime,
      );
      const nearby = await prisma.baseScheduleEntry.findMany({
        where: {
          employeeId: parsed.employeeId,
          date: { gte: subDays(date, 2), lte: addDays(date, 2) },
        },
        include: { shiftTemplate: true },
      });
      for (const a of nearby) {
        const win = shiftDateTimeWindow(
          a.date,
          a.shiftTemplate.startTime,
          a.shiftTemplate.endTime,
        );
        if (win.end <= nextStart && !respectsMinRest(win.end, nextStart, MIN_REST_HOURS)) {
          return NextResponse.json(
            {
              error: `Gesetzliche Ruhezeit (${MIN_REST_HOURS} Std.) unterschritten nach Ende ${format(win.end, "dd.MM. HH:mm")}.`,
              code: "REST",
            },
            { status: 409 },
          );
        }
        if (nextEnd <= win.start && !respectsMinRest(nextEnd, win.start, MIN_REST_HOURS)) {
          return NextResponse.json(
            {
              error: `Gesetzliche Ruhezeit (${MIN_REST_HOURS} Std.) unterschritten vor Beginn ${format(win.start, "dd.MM. HH:mm")}.`,
              code: "REST",
            },
            { status: 409 },
          );
        }
      }
    }

    const entry = await prisma.baseScheduleEntry.create({
      data: {
        date,
        shiftTemplateId: parsed.shiftTemplateId,
        employeeId: parsed.employeeId,
        note: parsed.note || null,
      },
      include: {
        employee: true,
        shiftTemplate: true,
      },
    });

    return NextResponse.json(
      { ...entry, date: format(startOfDay(entry.date), "yyyy-MM-dd") },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Dieser Eintrag existiert im Ursprungsplan bereits." },
        { status: 409 },
      );
    }
    return apiError(error, "Ursprungseintrag konnte nicht gespeichert werden");
  }
}
