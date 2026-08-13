-- CreateTable
CREATE TABLE "BaseScheduleEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "shiftTemplateId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BaseScheduleEntry_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "ShiftTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BaseScheduleEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "maxShifts" INTEGER NOT NULL DEFAULT 5,
    "vacationDaysPerYear" INTEGER NOT NULL DEFAULT 30,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shiftPreference" TEXT NOT NULL DEFAULT 'ANY',
    "rotationWeeks" INTEGER NOT NULL DEFAULT 1,
    "rotationStartDate" DATETIME,
    "rotationStartKind" TEXT NOT NULL DEFAULT 'DAY',
    "targetHours" REAL,
    "hoursPeriod" TEXT NOT NULL DEFAULT 'MONTH',
    "employmentType" TEXT NOT NULL DEFAULT 'FULL_TIME',
    "dutyModel" TEXT NOT NULL DEFAULT 'ROTATION_4_4',
    "dutyOnDays" INTEGER NOT NULL DEFAULT 4,
    "dutyOffDays" INTEGER NOT NULL DEFAULT 4,
    "dutyCycleStartDate" DATETIME,
    "allowFifthShiftPerMonth" BOOLEAN NOT NULL DEFAULT true,
    "partTimeStartTime" TEXT NOT NULL DEFAULT '09:00',
    "partTimeEndTime" TEXT NOT NULL DEFAULT '15:00',
    "workWeekdays" TEXT NOT NULL DEFAULT '1,2,3,4,5',
    "allowIntermediateShifts" BOOLEAN NOT NULL DEFAULT false,
    "defaultShiftTemplateId" TEXT,
    CONSTRAINT "Employee_defaultShiftTemplateId_fkey" FOREIGN KEY ("defaultShiftTemplateId") REFERENCES "ShiftTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("id", "name", "email", "active", "maxShifts", "vacationDaysPerYear", "createdAt", "shiftPreference", "rotationWeeks", "rotationStartDate", "rotationStartKind", "targetHours", "hoursPeriod")
SELECT "id", "name", "email", "active", "maxShifts", "vacationDaysPerYear", "createdAt", "shiftPreference", "rotationWeeks", "rotationStartDate", "rotationStartKind", "targetHours", "hoursPeriod" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";

CREATE TABLE "new_ShiftTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#334155',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL DEFAULT 'DAY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ShiftTemplate" ("id", "name", "startTime", "endTime", "color", "active", "sortOrder", "kind", "createdAt") SELECT "id", "name", "startTime", "endTime", "color", "active", "sortOrder", "kind", "createdAt" FROM "ShiftTemplate";
DROP TABLE "ShiftTemplate";
ALTER TABLE "new_ShiftTemplate" RENAME TO "ShiftTemplate";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "BaseScheduleEntry_date_idx" ON "BaseScheduleEntry"("date");

-- CreateIndex
CREATE UNIQUE INDEX "BaseScheduleEntry_date_shiftTemplateId_employeeId_key" ON "BaseScheduleEntry"("date", "shiftTemplateId", "employeeId");
