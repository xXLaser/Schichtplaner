import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { name: "asc" },
      include: {
        competencies: { include: { competency: true } },
        absences: { orderBy: { startDate: "desc" }, take: 5 },
        defaultShiftTemplate: true,
        _count: { select: { assignments: true } },
      },
    });
    return NextResponse.json(employees);
  } catch (error) {
    return apiError(error, "Mitarbeiter konnten nicht geladen werden");
  }
}

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable().or(z.literal("")),
  active: z.boolean().optional(),
  maxShifts: z.number().int().min(1).max(14).optional(),
  vacationDaysPerYear: z.number().int().min(0).max(60).optional(),
  competencyIds: z.array(z.string()).optional(),
  shiftPreference: z.enum(["ANY", "DAY_ONLY", "NIGHT_ONLY", "ROTATING"]).optional(),
  rotationWeeks: z.number().int().min(1).max(12).optional(),
  rotationStartDate: z.string().optional().nullable(),
  rotationStartKind: z.enum(["DAY", "NIGHT", "INTERMEDIATE"]).optional(),
  targetHours: z.number().min(0).max(1000).optional().nullable(),
  hoursPeriod: z.enum(["MONTH", "QUARTER"]).optional(),
  employmentType: z.enum(["FULL_TIME", "PART_TIME"]).optional(),
  dutyModel: z.enum(["ROTATION_4_4", "WEEKDAYS", "CUSTOM"]).optional(),
  dutyOnDays: z.number().int().min(1).max(14).optional(),
  dutyOffDays: z.number().int().min(0).max(14).optional(),
  dutyCycleStartDate: z.string().optional().nullable(),
  allowFifthShiftPerMonth: z.boolean().optional(),
  partTimeStartTime: z.string().optional(),
  partTimeEndTime: z.string().optional(),
  workWeekdays: z.string().optional(),
  allowIntermediateShifts: z.boolean().optional(),
  defaultShiftTemplateId: z.string().optional().nullable(),
  role: z.enum(["STAFF", "TEAM_LEADER"]).optional(),
  minRestHours: z.number().int().min(6).max(24).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const employee = await prisma.employee.create({
      data: {
        name: body.name,
        email: body.email || null,
        active: body.active ?? true,
        maxShifts: body.maxShifts ?? 5,
        vacationDaysPerYear: body.vacationDaysPerYear ?? 30,
        shiftPreference: body.shiftPreference ?? "ANY",
        rotationWeeks: body.rotationWeeks ?? 1,
        rotationStartDate: body.rotationStartDate
          ? new Date(body.rotationStartDate)
          : null,
        rotationStartKind:
          body.rotationStartKind === "NIGHT" ? "NIGHT" : "DAY",
        targetHours: body.targetHours ?? null,
        hoursPeriod: body.hoursPeriod ?? "MONTH",
        employmentType: body.employmentType ?? "FULL_TIME",
        dutyModel: body.dutyModel ?? "ROTATION_4_4",
        dutyOnDays: body.dutyOnDays ?? 4,
        dutyOffDays: body.dutyOffDays ?? 4,
        dutyCycleStartDate: body.dutyCycleStartDate
          ? new Date(body.dutyCycleStartDate)
          : null,
        allowFifthShiftPerMonth: body.allowFifthShiftPerMonth ?? true,
        partTimeStartTime: body.partTimeStartTime ?? "09:00",
        partTimeEndTime: body.partTimeEndTime ?? "15:00",
        workWeekdays: body.workWeekdays ?? "1,2,3,4,5",
        allowIntermediateShifts:
          body.allowIntermediateShifts ??
          body.role === "TEAM_LEADER",
        defaultShiftTemplateId: body.defaultShiftTemplateId || null,
        role: body.role ?? "STAFF",
        minRestHours:
          body.minRestHours ??
          (body.role === "TEAM_LEADER" ? 9 : 12),
        competencies: body.competencyIds
          ? {
              create: body.competencyIds.map((competencyId) => ({
                competencyId,
              })),
            }
          : undefined,
      },
      include: {
        competencies: { include: { competency: true } },
        defaultShiftTemplate: true,
      },
    });
    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    return apiError(error, "Mitarbeiter konnte nicht angelegt werden");
  }
}
