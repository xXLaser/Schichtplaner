import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL ?? "(nicht gesetzt)";
  const dbFile = path.join(process.cwd(), "prisma", "dev.db");
  const fileExists = fs.existsSync(dbFile);

  try {
    const [employees, competencies, absences, shifts] = await Promise.all([
      prisma.employee.count(),
      prisma.competency.count(),
      prisma.absence.count(),
      prisma.shiftTemplate.count(),
    ]);

    return NextResponse.json({
      ok: true,
      message: "Schichtwerk läuft und die Datenbank ist erreichbar.",
      cwd: process.cwd(),
      databaseUrl: dbUrl,
      databaseFileExists: fileExists,
      databaseFile: dbFile,
      counts: { employees, competencies, absences, shifts },
      hint:
        employees === 0
          ? "Datenbank ist leer. Im Projektordner ausführen: npm run db:seed"
          : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        ok: false,
        message: "Datenbankfehler – deshalb laden Mitarbeiter nicht.",
        cwd: process.cwd(),
        databaseUrl: dbUrl,
        databaseFileExists: fileExists,
        databaseFile: dbFile,
        error: message,
        fix: [
          "1. Im Projektordner eine Datei .env anlegen mit: DATABASE_URL=\"file:./dev.db\"",
          "2. Ausführen: npx prisma migrate deploy",
          "3. Ausführen: npm run db:seed",
          "4. Server neu starten (starten-server.bat)",
        ],
      },
      { status: 500 },
    );
  }
}
