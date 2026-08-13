import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import {
  DEFAULT_RUNTIME_CONFIG,
  readRuntimeConfig,
  writeRuntimeConfig,
} from "@/lib/runtime-config";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cfg = readRuntimeConfig();
    return NextResponse.json({
      ...cfg,
      // Passwort aus MySQL-URL nicht zurückgeben
      mysqlUrlMasked: maskMysql(cfg.mysqlUrl),
      defaults: DEFAULT_RUNTIME_CONFIG,
      restartHint:
        "Änderungen an Datenbankmodus oder Web-Zugriff werden nach Neustart der App wirksam.",
    });
  } catch (error) {
    return apiError(error, "Einstellungen konnten nicht geladen werden");
  }
}

const schema = z.object({
  dbMode: z.enum(["sqlite", "mysql"]).optional(),
  mysqlUrl: z.string().optional(),
  webAccess: z.boolean().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  holidayRegion: z.enum(["AT", "DE", "DE-BY", "NONE"]).optional(),
  companyName: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    // Während Setup ohne Session erlauben, sonst Admin nötig wenn User existiert
    const body = schema.parse(await req.json());
    if (body.dbMode === "mysql" && !(body.mysqlUrl ?? readRuntimeConfig().mysqlUrl)) {
      return NextResponse.json(
        { error: "Für MySQL ist eine Verbindungs-URL erforderlich." },
        { status: 400 },
      );
    }
    void user;
    const next = writeRuntimeConfig(body);
    return NextResponse.json({
      ...next,
      mysqlUrlMasked: maskMysql(next.mysqlUrl),
      restartRequired: Boolean(
        body.dbMode !== undefined ||
          body.mysqlUrl !== undefined ||
          body.webAccess !== undefined ||
          body.port !== undefined,
      ),
    });
  } catch (error) {
    return apiError(error, "Einstellungen konnten nicht gespeichert werden");
  }
}

function maskMysql(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return url.replace(/:([^:@/]+)@/, ":***@");
  }
}
