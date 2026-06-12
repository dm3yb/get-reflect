/*
 * Backup schedule model.
 *
 * launchd's StartCalendarInterval is purely calendar-based and cannot express
 * "every N weeks". We model an `interval` count here: launchd fires at the base
 * unit cadence (daily/weekly/monthly), and the backup script skips runs until
 * `interval` units have elapsed (see intervalToDays + the runtime gate).
 */

export type Frequency = "daily" | "weekly" | "monthly";

/** `interval` is the count of base units between runs (1 = every unit). */
export type Schedule =
  | { frequency: "daily"; interval: number; hour: number; minute: number }
  | { frequency: "weekly"; interval: number; weekday: number; hour: number; minute: number }
  | { frequency: "monthly"; interval: number; day: number; hour: number; minute: number };

/** launchd Weekday is 0 (Sunday) .. 6 (Saturday). */
export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Parse an "HH:MM" 24-hour string. Returns null if out of range or malformed. */
export function parseTime(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return { hour, minute };
}

/**
 * Days in one base unit, used to gate "every N units" runs. Monthly uses 28 —
 * a conservative lower bound for any real month.
 */
const UNIT_DAYS: Record<Frequency, number> = {
  daily: 1,
  weekly: 7,
  monthly: 28,
};

/**
 * Minimum days that must elapse between runs. Returns 0 when the interval is 1
 * (the calendar cadence alone is correct, so no runtime gating is needed).
 */
export function intervalToDays(schedule: Schedule): number {
  return schedule.interval <= 1 ? 0 : schedule.interval * UNIT_DAYS[schedule.frequency];
}

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function describeSchedule(schedule: Schedule): string {
  const at = `at ${formatTime(schedule.hour, schedule.minute)}`;
  const n = schedule.interval;
  switch (schedule.frequency) {
    case "daily":
      return n === 1 ? `Every day ${at}` : `Every ${n} days ${at}`;
    case "weekly": {
      const day = WEEKDAYS[schedule.weekday];
      return n === 1 ? `Every ${day} ${at}` : `Every ${n} weeks on ${day} ${at}`;
    }
    case "monthly":
      return n === 1
        ? `On day ${schedule.day} of every month ${at}`
        : `On day ${schedule.day} every ${n} months ${at}`;
  }
}
