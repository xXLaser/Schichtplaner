import { prisma } from "./prisma";

export const ONBOARDING_COMPLETED_KEY = "onboarding.completed";
export const ONBOARDING_STEP_KEY = "onboarding.step";

export type OnboardingStep =
  | "welcome"
  | "competencies"
  | "shifts"
  | "employees"
  | "schedule"
  | "apply"
  | "done";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  "welcome",
  "competencies",
  "shifts",
  "employees",
  "schedule",
  "apply",
  "done",
];

export type OnboardingStatus = {
  completed: boolean;
  step: OnboardingStep;
  counts: {
    competencies: number;
    shifts: number;
    employees: number;
    baseEntries: number;
  };
  canProceed: {
    competencies: boolean;
    shifts: boolean;
    employees: boolean;
    schedule: boolean;
  };
};

async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

async function getCounts() {
  const [competencies, shifts, employees, baseEntries] = await Promise.all([
    prisma.competency.count(),
    prisma.shiftTemplate.count({ where: { active: true } }),
    prisma.employee.count({ where: { active: true } }),
    prisma.baseScheduleEntry.count(),
  ]);
  return { competencies, shifts, employees, baseEntries };
}

function parseStep(value: string | null): OnboardingStep {
  if (value && ONBOARDING_STEPS.includes(value as OnboardingStep)) {
    return value as OnboardingStep;
  }
  return "welcome";
}

/** Status lesen; bestehende Installationen mit Daten werden automatisch abgeschlossen. */
export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  const counts = await getCounts();
  const flag = await getSetting(ONBOARDING_COMPLETED_KEY);

  if (flag === "true") {
    return {
      completed: true,
      step: "done",
      counts,
      canProceed: {
        competencies: counts.competencies >= 1,
        shifts: counts.shifts >= 1,
        employees: counts.employees >= 1,
        schedule: counts.baseEntries >= 1,
      },
    };
  }

  // Explizit zurückgesetzt → Wizard erzwingen (auch wenn Daten existieren)
  if (flag === "false") {
    const step = parseStep(await getSetting(ONBOARDING_STEP_KEY));
    return {
      completed: false,
      step,
      counts,
      canProceed: {
        competencies: counts.competencies >= 1,
        shifts: counts.shifts >= 1,
        employees: counts.employees >= 1,
        schedule: counts.baseEntries >= 1,
      },
    };
  }

  // Legacy / schon konfiguriert, Flag fehlt noch → einmalig abschließen
  if (
    counts.employees > 0 &&
    counts.competencies > 0 &&
    counts.shifts > 0
  ) {
    await setSetting(ONBOARDING_COMPLETED_KEY, "true");
    return {
      completed: true,
      step: "done",
      counts,
      canProceed: {
        competencies: true,
        shifts: true,
        employees: true,
        schedule: counts.baseEntries >= 1,
      },
    };
  }

  const step = parseStep(await getSetting(ONBOARDING_STEP_KEY));
  return {
    completed: false,
    step,
    counts,
    canProceed: {
      competencies: counts.competencies >= 1,
      shifts: counts.shifts >= 1,
      employees: counts.employees >= 1,
      schedule: counts.baseEntries >= 1,
    },
  };
}

export async function setOnboardingStep(step: OnboardingStep): Promise<OnboardingStatus> {
  await setSetting(ONBOARDING_STEP_KEY, step);
  return getOnboardingStatus();
}

export async function completeOnboarding(): Promise<OnboardingStatus> {
  const status = await getOnboardingStatus();
  if (!status.canProceed.competencies) {
    throw new Error("Mindestens eine Kompetenz ist erforderlich.");
  }
  if (!status.canProceed.shifts) {
    throw new Error("Mindestens eine Schicht ist erforderlich.");
  }
  if (!status.canProceed.employees) {
    throw new Error("Mindestens ein Mitarbeiter ist erforderlich.");
  }
  await setSetting(ONBOARDING_COMPLETED_KEY, "true");
  await setSetting(ONBOARDING_STEP_KEY, "done");
  return getOnboardingStatus();
}

export async function resetOnboarding(): Promise<OnboardingStatus> {
  await setSetting(ONBOARDING_COMPLETED_KEY, "false");
  await setSetting(ONBOARDING_STEP_KEY, "welcome");
  return getOnboardingStatus();
}
