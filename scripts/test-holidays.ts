import assert from "node:assert/strict";
import { easterSunday, holidaysForYear, holidaysInRange } from "../src/lib/holidays";

const easter2026 = easterSunday(2026);
assert.equal(easter2026.getFullYear(), 2026);
assert.equal(easter2026.getMonth(), 3);
assert.equal(easter2026.getDate(), 5);

const at = holidaysForYear(2026, "AT");
assert.ok(at.some((h) => h.date === "2026-01-01" && h.name === "Neujahr"));
assert.ok(at.some((h) => h.date === "2026-10-26" && h.name === "Nationalfeiertag"));
assert.ok(at.some((h) => h.date === "2026-04-06" && h.name === "Ostermontag"));

const de = holidaysForYear(2026, "DE");
assert.ok(de.some((h) => h.date === "2026-10-03"));
assert.ok(!de.some((h) => h.date === "2026-10-26"));

const range = holidaysInRange(
  new Date("2026-08-01T00:00:00"),
  new Date("2026-08-31T00:00:00"),
  "AT",
);
assert.ok(range.some((h) => h.date === "2026-08-15"));

console.log("holiday tests OK");
