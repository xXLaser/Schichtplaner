import { suggestBaseSchedule } from "../src/lib/baseSchedule";
import { generateSchedule } from "../src/lib/scheduler";
import { format, startOfWeek, addDays } from "date-fns";

async function main() {
  const start = format(
    startOfWeek(new Date(), { weekStartsOn: 1 }),
    "yyyy-MM-dd",
  );
  const end = format(addDays(new Date(start + "T00:00:00"), 6), "yyyy-MM-dd");
  const sug = await suggestBaseSchedule(start, end, { replaceExisting: true });
  const gen = await generateSchedule(start, end, { replaceExisting: true });
  console.log({
    sug,
    created: gen.created,
    fromBase: gen.fromBase,
    warnings: gen.warnings.length,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
