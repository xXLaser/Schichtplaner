-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "minRestHours" INTEGER NOT NULL DEFAULT 12,
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
INSERT INTO "new_Employee" ("id", "name", "email", "active", "maxShifts", "vacationDaysPerYear", "createdAt", "shiftPreference", "rotationWeeks", "rotationStartDate", "rotationStartKind", "targetHours", "hoursPeriod", "employmentType", "dutyModel", "dutyOnDays", "dutyOffDays", "dutyCycleStartDate", "allowFifthShiftPerMonth", "partTimeStartTime", "partTimeEndTime", "workWeekdays", "allowIntermediateShifts", "defaultShiftTemplateId") SELECT "id", "name", "email", "active", "maxShifts", "vacationDaysPerYear", "createdAt", "shiftPreference", "rotationWeeks", "rotationStartDate", "rotationStartKind", "targetHours", "hoursPeriod", "employmentType", "dutyModel", "dutyOnDays", "dutyOffDays", "dutyCycleStartDate", "allowFifthShiftPerMonth", "partTimeStartTime", "partTimeEndTime", "workWeekdays", "allowIntermediateShifts", "defaultShiftTemplateId" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
