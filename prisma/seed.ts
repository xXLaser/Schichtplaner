import { PrismaClient, AbsenceType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.assignment.deleteMany();
  await prisma.absence.deleteMany();
  await prisma.shiftRequirement.deleteMany();
  await prisma.employeeCompetency.deleteMany();
  await prisma.shiftTemplate.deleteMany();
  await prisma.employee.deleteMany();
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

  const employees = await Promise.all([
    prisma.employee.create({
      data: {
        name: "Anna Berger",
        email: "anna.berger@beispiel.de",
        maxShifts: 10,
        competencies: {
          create: [
            { competencyId: leitung.id },
            { competencyId: qs.id },
            { competencyId: ersteHilfe.id },
          ],
        },
      },
    }),
    prisma.employee.create({
      data: {
        name: "Markus Hofmann",
        email: "markus.hofmann@beispiel.de",
        maxShifts: 12,
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
        maxShifts: 10,
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
        maxShifts: 12,
        competencies: {
          create: [
            { competencyId: logistik.id },
            { competencyId: qs.id },
          ],
        },
      },
    }),
    prisma.employee.create({
      data: {
        name: "Lea Fischer",
        email: "lea.fischer@beispiel.de",
        maxShifts: 10,
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
        maxShifts: 12,
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
        maxShifts: 10,
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
        maxShifts: 12,
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
        maxShifts: 10,
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
        maxShifts: 12,
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
      name: "Frühschicht",
      startTime: "06:00",
      endTime: "14:00",
      color: "#0f766e",
      sortOrder: 1,
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
      name: "Spätschicht",
      startTime: "14:00",
      endTime: "22:00",
      color: "#0369a1",
      sortOrder: 2,
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

  const nacht = await prisma.shiftTemplate.create({
    data: {
      name: "Nachtschicht",
      startTime: "22:00",
      endTime: "06:00",
      color: "#334155",
      sortOrder: 3,
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

  // Sample absences next week
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));

  await prisma.absence.create({
    data: {
      employeeId: employees[0].id,
      type: AbsenceType.VACATION,
      startDate: nextMonday,
      endDate: new Date(nextMonday.getTime() + 4 * 24 * 60 * 60 * 1000),
      note: "Sommerurlaub",
    },
  });

  await prisma.absence.create({
    data: {
      employeeId: employees[3].id,
      type: AbsenceType.SICK,
      startDate: nextMonday,
      endDate: new Date(nextMonday.getTime() + 1 * 24 * 60 * 60 * 1000),
      note: "Erkältung",
    },
  });

  console.log("Seed OK:", {
    competencies: comps.length,
    employees: employees.length,
    shifts: [frueh.name, spaet.name, nacht.name],
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
