import assert from "node:assert/strict";
import { addDays, startOfDay } from "date-fns";
import {
  canTakeAnotherShiftThisWeek,
  isDutyDay,
  MIN_REST_HOURS,
  respectsMinRest,
  shiftDateTimeWindow,
  shiftMatchesDutyModel,
  type DutyModelConfig,
} from "../src/lib/dutyModel";

function base(partial: Partial<DutyModelConfig> = {}): DutyModelConfig {
  return {
    employmentType: "FULL_TIME",
    dutyModel: "ROTATION_4_4",
    dutyOnDays: 4,
    dutyOffDays: 4,
    dutyCycleStartDate: startOfDay(new Date("2026-08-01T00:00:00")),
    allowFifthShiftPerMonth: true,
    partTimeStartTime: "09:00",
    partTimeEndTime: "15:00",
    workWeekdays: "1,2,3,4,5",
    allowIntermediateShifts: false,
    defaultShiftTemplateId: null,
    maxShifts: 5,
    ...partial,
  };
}

const start = startOfDay(new Date("2026-08-01T00:00:00"));

for (let i = 0; i < 4; i++) {
  assert.equal(isDutyDay(base(), addDays(start, i)), true, `on day ${i}`);
}
for (let i = 4; i < 8; i++) {
  assert.equal(isDutyDay(base(), addDays(start, i)), false, `off day ${i}`);
}
assert.equal(isDutyDay(base(), addDays(start, 8)), true, "cycle restarts");

const pt = base({ dutyModel: "WEEKDAYS", employmentType: "PART_TIME" });
assert.equal(isDutyDay(pt, new Date("2026-08-03T00:00:00")), true);
assert.equal(isDutyDay(pt, new Date("2026-08-08T00:00:00")), false);

assert.equal(
  shiftMatchesDutyModel(base(), {
    startTime: "11:00",
    endTime: "23:00",
    kind: "INTERMEDIATE",
  }),
  false,
);
assert.equal(
  shiftMatchesDutyModel(base({ allowIntermediateShifts: true }), {
    startTime: "11:00",
    endTime: "23:00",
    kind: "INTERMEDIATE",
  }),
  true,
);

assert.equal(
  shiftMatchesDutyModel(pt, {
    startTime: "09:00",
    endTime: "15:00",
    kind: "DAY",
  }),
  true,
);
assert.equal(
  shiftMatchesDutyModel(pt, {
    startTime: "06:00",
    endTime: "14:00",
    kind: "DAY",
  }),
  false,
);

const zwischen = shiftDateTimeWindow(
  new Date("2026-08-10T00:00:00"),
  "11:00",
  "23:00",
);
const frueh = shiftDateTimeWindow(
  new Date("2026-08-11T00:00:00"),
  "06:00",
  "18:00",
);
assert.equal(respectsMinRest(zwischen.end, frueh.start, MIN_REST_HOURS), false);
const spaet = shiftDateTimeWindow(
  new Date("2026-08-11T00:00:00"),
  "12:00",
  "20:00",
);
assert.equal(respectsMinRest(zwischen.end, spaet.start, MIN_REST_HOURS), true);

const fifth = new Set<string>();
assert.equal(
  canTakeAnotherShiftThisWeek(
    base(),
    new Date("2026-08-10T00:00:00"),
    4,
    fifth,
  ),
  true,
);
// Simuliere: in Kalenderwoche von Aug 10 schon 5 Dienste genutzt
fifth.add("2026-08|2026-W33");
assert.equal(
  canTakeAnotherShiftThisWeek(
    base(),
    new Date("2026-08-17T00:00:00"),
    4,
    fifth,
  ),
  false,
  "zweite 5er-Woche im Monat blockiert",
);

console.log("dutyModel tests OK");
