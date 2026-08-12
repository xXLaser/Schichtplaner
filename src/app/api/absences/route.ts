import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { parseISO, startOfDay, format } from "date-fns";
import { countVacationDays } from "@/lib/vacation";
import { generateSchedule } from "@/lib/scheduler";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");
    const type = req.nextUrl.searchParams.get("type");
    const status = req.nextUrl.searchParams.get("status");

    const absences = await prisma.absence.findMany({
      where: {
        ...(from && to
          ? {
              startDate: { lte: startOfDay(parseISO(to)) },
              endDate: { gte: startOfDay(parseISO(from)) },
            }
          : {}),
        ...(type ? { type: type as "VACATION" | "SICK" | "OTHER" } : {}),
        ...(status
          ? { status: status as "PENDING" | "APPROVED" | "REJECTED" }
          : {}),
      },
      include: { employee: true },
      orderBy: { startDate: "desc" },
    });
    return NextResponse.json(absences);
  } catch (error) {
    return apiError(error, "Abwesenheiten konnten nicht geladen werden");
  }
}

const schema = z.object({
  employeeId: z.string().min(1),
  type: z.enum(["VACATION", "SICK", "OTHER"]),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  startDate: z.string(),
  endDate: z.string(),
  note: z.string().optional().nullable(),
  compensate: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());

    // Default: Urlaub aus Planner = PENDING, Krankenstand = APPROVED
    const status =
      body.status ??
      (body.type === "VACATION" ? "PENDING" : "APPROVED");

    if (body.type === "VACATION" && status !== "REJECTED") {
      const days = countVacationDays(body.startDate, body.endDate);
      const employee = await prisma.employee.findUniqueOrThrow({
        where: { id: body.employeeId },
      });
      const year = Number(body.startDate.slice(0, 4));
      const existing = await prisma.absence.findMany({
        where: {
          employeeId: body.employeeId,
          type: "VACATION",
          status: { in: ["PENDING", "APPROVED"] },
          startDate: {
            gte: startOfDay(parseISO(`${year}-01-01`)),
            lte: startOfDay(parseISO(`${year}-12-31`)),
          },
        },
      });
      const used = existing.reduce(
        (sum, v) =>
          sum +
          countVacationDays(
            format(startOfDay(v.startDate), "yyyy-MM-dd"),
            format(startOfDay(v.endDate), "yyyy-MM-dd"),
          ),
        0,
      );
      if (used + days > employee.vacationDaysPerYear) {
        return NextResponse.json(
          {
            error: `Nicht genug Urlaubstage. Verfügbar: ${employee.vacationDaysPerYear - used}, beantragt: ${days}`,
            available: employee.vacationDaysPerYear - used,
            requested: days,
          },
          { status: 400 },
        );
      }
    }

    const absence = await prisma.absence.create({
      data: {
        employeeId: body.employeeId,
        type: body.type,
        status,
        startDate: startOfDay(parseISO(body.startDate)),
        endDate: startOfDay(parseISO(body.endDate)),
        note: body.note || null,
      },
      include: { employee: true },
    });

    let compensation = null;
    if (body.compensate !== false && status === "APPROVED") {
      compensation = await generateSchedule(body.startDate, body.endDate, {
        replaceExisting: true,
      });
    }

    return NextResponse.json({ ...absence, compensation }, { status: 201 });
  } catch (error) {
    return apiError(error, "Abwesenheit konnte nicht gespeichert werden");
  }
}
