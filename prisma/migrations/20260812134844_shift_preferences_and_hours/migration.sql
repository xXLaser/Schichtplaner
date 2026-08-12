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
    "hoursPeriod" TEXT NOT NULL DEFAULT 'MONTH'
);
INSERT INTO "new_Employee" ("active", "createdAt", "email", "id", "maxShifts", "name", "vacationDaysPerYear") SELECT "active", "createdAt", "email", "id", "maxShifts", "name", "vacationDaysPerYear" FROM "Employee";
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
INSERT INTO "new_ShiftTemplate" ("active", "color", "createdAt", "endTime", "id", "name", "sortOrder", "startTime") SELECT "active", "color", "createdAt", "endTime", "id", "name", "sortOrder", "startTime" FROM "ShiftTemplate";
DROP TABLE "ShiftTemplate";
ALTER TABLE "new_ShiftTemplate" RENAME TO "ShiftTemplate";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
