import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { getAppConfig, saveAppConfig } from "@/lib/appConfig";
import { prisma } from "@/lib/prisma";
import { getSession, userCount } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SETTINGS_REGION_KEY = "holiday.region";
const SETTINGS_PLANNING_KEY = "planning.days";

async function mergedSettings() {
  const file = getAppConfig();
  const [regionRow, daysRow] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: SETTINGS_REGION_KEY } }),
    prisma.appSetting.findUnique({ where: { key: SETTINGS_PLANNING_KEY } }),
  ]);
  return {
    databaseProvider: file.databaseProvider,
    webAccess: file.webAccess,
    host: file.host,
    port: file.port,
    holidayRegion:
      regionRow?.value === "DE" || regionRow?.value === "AT"
        ? regionRow.value
        : file.holidayRegion,
    planningDays: daysRow?.value
      ? Number(daysRow.value) || file.planningDays
      : file.planningDays,
    restartHint:
      "Änderungen an Datenbank oder Webzugriff gelten nach einem Neustart der Anwendung.",
  };
}

export async function GET() {
  try {
    const settings = await mergedSettings();
    return NextResponse.json(settings);
  } catch (error) {
    return apiError(error, "Einstellungen konnten nicht geladen werden");
  }
}

const schema = z.object({
  webAccess: z.boolean().optional(),
  holidayRegion: z.enum(["AT", "DE"]).optional(),
  planningDays: z.number().int().min(7).max(28).optional(),
  mysqlUrl: z.string().optional(),
  databaseProvider: z.enum(["sqlite", "mysql"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const hasUsers = (await userCount()) > 0;
    if (hasUsers) {
      const session = await getSession();
      if (!session || session.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Nur Administratoren dürfen Einstellungen ändern." },
          { status: 403 },
        );
      }
    }

    const body = schema.parse(await req.json());
    const current = getAppConfig();
    const next = saveAppConfig({
      webAccess: body.webAccess ?? current.webAccess,
      holidayRegion: body.holidayRegion ?? current.holidayRegion,
      planningDays: body.planningDays ?? current.planningDays,
      databaseProvider: body.databaseProvider ?? current.databaseProvider,
      databaseUrl:
        body.databaseProvider === "mysql" && body.mysqlUrl
          ? body.mysqlUrl
          : current.databaseUrl,
    });

    if (body.holidayRegion) {
      await prisma.appSetting.upsert({
        where: { key: SETTINGS_REGION_KEY },
        create: { key: SETTINGS_REGION_KEY, value: body.holidayRegion },
        update: { value: body.holidayRegion },
      });
    }
    if (body.planningDays) {
      await prisma.appSetting.upsert({
        where: { key: SETTINGS_PLANNING_KEY },
        create: { key: SETTINGS_PLANNING_KEY, value: String(body.planningDays) },
        update: { value: String(body.planningDays) },
      });
    }

    return NextResponse.json({
      ...next,
      restartHint:
        "Webzugriff und Datenbank greifen nach einem Neustart der EXE.",
    });
  } catch (error) {
    return apiError(error, "Einstellungen konnten nicht gespeichert werden");
  }
}
