import assert from "node:assert/strict";
import {
  applyStaffRoleDefaults,
  fillPriority,
  isPartTimeShift,
  isTeamLeadShift,
  staffAllowsShift,
} from "../src/lib/staffRules";

const operator = applyStaffRoleDefaults("OPERATOR");
const lead = applyStaffRoleDefaults("TEAM_LEAD");
const part = applyStaffRoleDefaults("PART_TIME");

const tag = { startTime: "06:00", endTime: "18:00", kind: "DAY" as const };
const nacht = { startTime: "18:00", endTime: "06:00", kind: "NIGHT" as const };
const team = { startTime: "12:00", endTime: "21:00", kind: "INTERMEDIATE" as const };
const tz = { startTime: "09:00", endTime: "15:00", kind: "DAY" as const };

assert.equal(staffAllowsShift(operator, tag), true);
assert.equal(staffAllowsShift(operator, nacht), true);
assert.equal(staffAllowsShift(operator, team), false);
assert.equal(staffAllowsShift(operator, tz), false);

assert.equal(staffAllowsShift(lead, tag), false);
assert.equal(staffAllowsShift(lead, nacht), false);
assert.equal(staffAllowsShift(lead, team), true);

assert.equal(staffAllowsShift(part, tag), false);
assert.equal(staffAllowsShift(part, nacht), false);
assert.equal(staffAllowsShift(part, tz), true);

assert.equal(isPartTimeShift(tz), true);
assert.equal(isPartTimeShift(tag), false);
assert.equal(isTeamLeadShift(team), true);
assert.equal(fillPriority(team) < fillPriority(tag), true);
assert.equal(fillPriority(tz) < fillPriority(nacht), true);

console.log("staffRules tests OK");
