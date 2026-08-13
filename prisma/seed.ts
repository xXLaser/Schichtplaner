import { PrismaClient, AbsenceType } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Beispieldaten laden.
 * Standard: bricht ab, wenn schon Mitarbeiter existieren (schützt Testdaten).
 * Erzwingen: FORCE_SEED=1 npm run db:seed   oder   npm run db:seed:force
 */
async function main() {
  const force =
    process.env.FORCE_SEED === "1" ||
    process.argv.includes("--force");

  const existing = await prisma.employee.count();
  if (existing > 0 && !force) {
    console.log(
      `Abbruch: Es gibt bereits ${existing} Mitarbeiter in der Datenbank.`,
    );
    console.log(
      "Testdaten bleiben erhalten. Zum Überschreiben bewusst ausführen:",
    );
    console.log("  npm run db:seed:force");
    return;
  }

  if (force && existing > 0) {
    console.log(
      `WARNUNG: Bestehende Daten werden gelöscht (${existing} Mitarbeiter) ...`,
    );
  }

  await prisma.assignment.deleteMany();
  await prisma.baseScheduleEntry.deleteMany();
  await prisma.absence.deleteMany();
  await prisma.shiftRequirement.deleteMany();
  await prisma.employeeCompetency.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.shiftTemplate.deleteMany();
  await prisma.competency.deleteMany();

  const comps = await Promise.all([
    prisma.competency.create({
      data: { name: "Schichtleitung", description: "Verantwortlich für die Schicht", color: "#0f766e" },
    }),
    prisma.competency.create({
      data: { name: "Maschinenführung", description: "Bedienung der Hauptanlagen", color: "#0369a1" },
    }),
    prisma.competency.create({
      data: { name: "Qualitätssicherung", description: "Prüfung und Dokumentation", color: "#b45309" },
    }),
    prisma.competency.create({
      data: { name: "Logistik", description: "Materialfluss und Kommissionierung", color: "#7c3aed" },
    }),
    prisma.competency.create({
      data: { name: "Erste Hilfe", description: "Ausgebildeter Ersthelfer", color: "#be123c" },
    }),
  ]);

  const [leitung, maschine, qs, logistik, ersteHilfe] = comps;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const offset = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - days);
    return d;
  };

  const employees = await Promise.all([
    // Vollzeit 4/4, nur Tag
    prisma.employee.create({
      data: {
        name: "Anna Berger",
        email: "anna.berger@beispiel.de",
        maxShifts: 5,
        employmentType: "FULL_TIME",
        dutyModel: "ROTATION_4_4",
        dutyOnDays: 4,
        dutyOffDays: 4,
        dutyCycleStartDate: offset(0),
        allowFifthShiftPerMonth: true,
        shiftPreference: "DAY_ONLY",
        targetHours: 160,
        hoursPeriod: "MONTH",
        competencies: {
          create: [
            { competencyId: leitung.id },
            { competencyId: qs.id },
            { competencyId: ersteHilfe.id },
          ],
        },
      },
    }),
    // Vollzeit 4/4 + Wechsel Tag/Nacht
    prisma.employee.create({
      data: {
        name: "Markus Hofmann",
        email: "markus.hofmann@beispiel.de",
        maxShifts: 5,
        employmentType: "FULL_TIME",
        dutyModel: "ROTATION_4_4",
        dutyOnDays: 4,
        dutyOffDays: 4,
        dutyCycleStartDate: offset(2),
        allowFifthShiftPerMonth: true,
        allowIntermediateShifts: true,
        shiftPreference: "ROTATING",
        rotationWeeks: 1,
        rotationStartDate: today,
        rotationStartKind: "NIGHT",
        targetHours: 160,
        hoursPeriod: "MONTH",
        competencies: {
          create: [
            { competencyId: maschine.id },
            { competencyId: logistik.id },
          ],
        },
      },
    }),
    prisma.employee.create({
      data: {
        name: "Sara Klein",
        email: "sara.klein@beispiel.de",
        maxShifts: 5,
        employmentType: "FULL_TIME",
        dutyModel: "ROTATION_4_4",
        dutyOnDays: 4,
        dutyOffDays: 4,
        dutyCycleStartDate: offset(4),
        allowFifthShiftPerMonth: true,
        shiftPreference: "DAY_ONLY",
        targetHours: 480,
        hoursPeriod: "QUARTER",
        competencies: {
          create: [
            { competencyId: leitung.id },
            { competencyId: maschine.id },
            { competencyId: ersteHilfe.id },
          ],
        },
      },
    }),
    prisma.employee.create({
      data: {
        name: "Tom Weber",
        email: "tom.weber@beispiel.de",
        maxShifts: 5,
        employmentType: "FULL_TIME",
        dutyModel: "ROTATION_4_4",
        dutyOnDays: 4,
        dutyOffDays: 4,
        dutyCycleStartDate: offset(1),
        allowFifthShiftPerMonth: true,
        shiftPreference: "NIGHT_ONLY",
        targetHours: 160,
        hoursPeriod: "MONTH",
        competencies: {
          create: [
            { competencyId: logistik.id },
            { competencyId: qs.id },
          ],
        },
      },
    }),
    // Teilzeit Mo–Fr 9–15
    prisma.employee.create({
      data: {
        name: "Lea Fischer",
        email: "lea.fischer@beispiel.de",
        maxShifts: 5,
        employmentType: "PART_TIME",
        dutyModel: "WEEKDAYS",
        partTimeStartTime: "09:00",
        partTimeEndTime: "15:00",
        workWeekdays: "1,2,3,4,5",
        allowFifthShiftPerMonth: false,
        allowIntermediateShifts: false,
        shiftPreference: "DAY_ONLY",
        targetHours: 120,
        hoursPeriod: "MONTH",
        competencies: {
          create: [
            { competencyId: qs.id },
            { competencyId: ersteHilfe.id },
            { competencyId: logistik.id },
          ],
        },
      },
    }),
    prisma.employee.create({
      data: {
        name: "Jonas Richter",
        email: "jonas.richter@beispiel.de",
        maxShifts: 5,
        employmentType: "FULL_TIME",
        dutyModel: "ROTATION_4_4",
        dutyOnDays: 4,
        dutyOffDays: 4,
        dutyCycleStartDate: offset(3),
        allowFifthShiftPerMonth: true,
        shiftPreference: "ROTATING",
        rotationWeeks: 2,
        rotationStartDate: today,
        rotationStartKind: "DAY",
        targetHours: 160,
        hoursPeriod: "MONTH",
        competencies: {
          create: [
            { competencyId: maschine.id },
            { competencyId: leitung.id },
          ],
        },
      },
    }),
    prisma.employee.create({
      data: {
        name: "Nina Schulz",
        email: "nina.schulz@beispiel.de",
        maxShifts: 5,
        employmentType: "FULL_TIME",
        dutyModel: "ROTATION_4_4",
        dutyOnDays: 4,
        dutyOffDays: 4,
        dutyCycleStartDate: offset(5),
        allowFifthShiftPerMonth: true,
        allowIntermediateShifts: true,
        shiftPreference: "NIGHT_ONLY",
        targetHours: 160,
        hoursPeriod: "MONTH",
        competencies: {
          create: [
            { competencyId: logistik.id },
            { competencyId: maschine.id },
          ],
        },
      },
    }),
    prisma.employee.create({
      data: {
        name: "Paul Wagner",
        email: "paul.wagner@beispiel.de",
        maxShifts: 5,
        employmentType: "FULL_TIME",
        dutyModel: "ROTATION_4_4",
        dutyOnDays: 4,
        dutyOffDays: 4,
        dutyCycleStartDate: offset(6),
        allowFifthShiftPerMonth: true,
        allowIntermediateShifts: true,
        shiftPreference: "ANY",
        targetHours: 160,
        hoursPeriod: "MONTH",
        competencies: {
          create: [
            { competencyId: qs.id },
            { competencyId: maschine.id },
            { competencyId: ersteHilfe.id },
          ],
        },
      },
    }),
    prisma.employee.create({
      data: {
        name: "Elena Vogt",
        email: "elena.vogt@beispiel.de",
        maxShifts: 5,
        employmentType: "PART_TIME",
        dutyModel: "WEEKDAYS",
        partTimeStartTime: "09:00",
        partTimeEndTime: "15:00",
        workWeekdays: "1,2,3,4,5",
        allowIntermediateShifts: true,
        shiftPreference: "DAY_ONLY",
        targetHours: 100,
        hoursPeriod: "MONTH",
        competencies: {
          create: [
            { competencyId: leitung.id },
            { competencyId: qs.id },
            { competencyId: logistik.id },
          ],
        },
      },
    }),
    prisma.employee.create({
      data: {
        name: "Felix Braun",
        email: "felix.braun@beispiel.de",
        maxShifts: 5,
        employmentType: "FULL_TIME",
        dutyModel: "ROTATION_4_4",
        dutyOnDays: 4,
        dutyOffDays: 4,
        dutyCycleStartDate: offset(7),
        allowFifthShiftPerMonth: true,
        shiftPreference: "NIGHT_ONLY",
        targetHours: 160,
        hoursPeriod: "MONTH",
        competencies: {
          create: [
            { competencyId: maschine.id },
            { competencyId: ersteHilfe.id },
            { competencyId: logistik.id },
          ],
        },
      },
    }),
  ]);

  const frueh = await prisma.shiftTemplate.create({
    data: {
      name: "Tagschicht",
      startTime: "06:00",
      endTime: "18:00",
      color: "#0f766e",
      sortOrder: 1,
      kind: "DAY",
      requirements: {
        create: [
          { competencyId: leitung.id, minCount: 1 },
          { competencyId: maschine.id, minCount: 2 },
          { competencyId: qs.id, minCount: 1 },
          { competencyId: logistik.id, minCount: 1 },
          { competencyId: ersteHilfe.id, minCount: 1 },
        ],
      },
    },
  });

  const spaet = await prisma.shiftTemplate.create({
    data: {
      name: "Teilzeit Tag",
      startTime: "09:00",
      endTime: "15:00",
      color: "#0369a1",
      sortOrder: 2,
      kind: "DAY",
      requirements: {
        create: [
          { competencyId: qs.id, minCount: 1 },
          { competencyId: logistik.id, minCount: 1 },
        ],
      },
    },
  });

  const nacht = await prisma.shiftTemplate.create({
    data: {
      name: "Nachtschicht",
      startTime: "18:00",
      endTime: "06:00",
      color: "#1e3a5f",
      sortOrder: 3,
      kind: "NIGHT",
      requirements: {
        create: [
          { competencyId: leitung.id, minCount: 1 },
          { competencyId: maschine.id, minCount: 1 },
          { competencyId: qs.id, minCount: 1 },
          { competencyId: ersteHilfe.id, minCount: 1 },
        ],
      },
    },
  });

  const teilzeit = spaet; // Teilzeit Tag 09–15

  const zwischen = await prisma.shiftTemplate.create({
    data: {
      name: "Teamleiter (9h)",
      startTime: "09:00",
      endTime: "18:00",
      color: "#b45309",
      sortOrder: 4,
      kind: "INTERMEDIATE",
      requirements: {
        create: [
          { competencyId: leitung.id, minCount: 1 },
        ],
      },
    },
  });

  // Teilzeit-Mitarbeiter an Teilzeitschicht koppeln
  const partTimers = employees.filter((e) => e.employmentType === "PART_TIME");
  for (const emp of partTimers) {
    await prisma.employee.update({
      where: { id: emp.id },
      data: { defaultShiftTemplateId: teilzeit.id },
    });
  }
  // Teamleiter-Beispiel: jemand mit Intermediate-Erlaubnis
  const tlCandidate =
    employees.find((e) => e.allowIntermediateShifts && e.name.includes("Paul")) ??
    employees.find((e) => e.allowIntermediateShifts);
  if (tlCandidate) {
    await prisma.employee.update({
      where: { id: tlCandidate.id },
      data: {
        role: "TEAM_LEADER",
        allowIntermediateShifts: true,
        defaultShiftTemplateId: zwischen.id,
      },
    });
  }

  // Sample absences next week
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));

  await prisma.absence.create({
    data: {
      employeeId: employees[0].id,
      type: AbsenceType.VACATION,
      status: "APPROVED",
      startDate: nextMonday,
      endDate: new Date(nextMonday.getTime() + 4 * 24 * 60 * 60 * 1000),
      note: "Sommerurlaub",
    },
  });

  await prisma.absence.create({
    data: {
      employeeId: employees[3].id,
      type: AbsenceType.SICK,
      status: "APPROVED",
      startDate: nextMonday,
      endDate: new Date(nextMonday.getTime() + 1 * 24 * 60 * 60 * 1000),
      note: "Erkältung",
    },
  });

  // Extra pending vacation for planner demo
  await prisma.absence.create({
    data: {
      employeeId: employees[2].id,
      type: AbsenceType.VACATION,
      status: "PENDING",
      startDate: new Date(nextMonday.getTime() + 14 * 24 * 60 * 60 * 1000),
      endDate: new Date(nextMonday.getTime() + 18 * 24 * 60 * 60 * 1000),
      note: "Familienurlaub (Antrag)",
    },
  });

  console.log("Seed OK:", {
    competencies: comps.length,
    employees: employees.length,
    shifts: [frueh.name, spaet.name, nacht.name, zwischen.name],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
