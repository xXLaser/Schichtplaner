import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAppConfig, updateAppConfig } from "@/lib/appConfig";
import { apiError } from "@/lib/api-error";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await getAppConfig();
    return NextResponse.json({
      ...config,
      mysqlUrl: config.mysqlUrl ? "••••••••" : null,
      effectiveDatabase: process.env.DATABASE_URL?.startsWith("mysql")
        ? "mysql"
        : config.databaseMode,
      hostname: process.env.HOSTNAME ?? null,
    });
  } catch (error) {
    return apiError(error, "Einstellungen konnten nicht geladen werden");
  }
}

const schema = z.object({
  databaseMode: z.enum(["local", "mysql"]).optional(),
  mysqlUrl: z.string().optional().nullable(),
  webAccess: z.enum(["local", "network"]).optional(),
  federalState: z.string().optional(),
  newPassword: z.string().min(8).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const config = await updateAppConfig({
      databaseMode: body.databaseMode,
      mysqlUrl: body.mysqlUrl === "••••••••" ? undefined : body.mysqlUrl,
      webAccess: body.webAccess,
      federalState: body.federalState,
    });

    if (body.newPassword) {
      const user = await prisma.user.findFirst();
      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: hashPassword(body.newPassword) },
        });
      }
    }

    return NextResponse.json({
      ...config,
      mysqlUrl: config.mysqlUrl ? "••••••••" : null,
      message:
        "Einstellungen gespeichert. Datenbank- und Netzwerkänderungen erfordern einen Neustart der Anwendung.",
    });
  } catch (error) {
    return apiError(error, "Einstellungen konnten nicht gespeichert werden");
  }
}
