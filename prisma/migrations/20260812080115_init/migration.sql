-- CreateTable
CREATE TABLE "Competency" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#0d9488',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "maxShifts" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EmployeeCompetency" (
    "employeeId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,

    PRIMARY KEY ("employeeId", "competencyId"),
    CONSTRAINT "EmployeeCompetency_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmployeeCompetency_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Absence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Absence_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShiftTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#334155',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ShiftRequirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shiftTemplateId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "minCount" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "ShiftRequirement_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "ShiftTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShiftRequirement_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "shiftTemplateId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "competencyId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assignment_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "ShiftTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Assignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Competency_name_key" ON "Competency"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftRequirement_shiftTemplateId_competencyId_key" ON "ShiftRequirement"("shiftTemplateId", "competencyId");

-- CreateIndex
CREATE INDEX "Assignment_date_idx" ON "Assignment"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_date_shiftTemplateId_employeeId_key" ON "Assignment"("date", "shiftTemplateId", "employeeId");
