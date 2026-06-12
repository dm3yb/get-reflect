import { describe, it, expect } from "vitest";
import { describeSchedule, intervalToDays, parseTime, WEEKDAYS } from "../../src/setup/schedule.js";

describe("parseTime", () => {
  it("parses HH:MM into hour and minute", () => {
    expect(parseTime("02:00")).toEqual({ hour: 2, minute: 0 });
    expect(parseTime("23:59")).toEqual({ hour: 23, minute: 59 });
    expect(parseTime("9:5")).toEqual({ hour: 9, minute: 5 });
  });

  it("returns null for invalid input", () => {
    expect(parseTime("24:00")).toBeNull();
    expect(parseTime("12:60")).toBeNull();
    expect(parseTime("noon")).toBeNull();
    expect(parseTime("")).toBeNull();
    expect(parseTime("1200")).toBeNull();
  });
});

describe("intervalToDays", () => {
  it("returns 0 for an interval of 1 (no gating needed)", () => {
    expect(intervalToDays({ frequency: "daily", interval: 1, hour: 2, minute: 0 })).toBe(0);
    expect(
      intervalToDays({ frequency: "weekly", interval: 1, weekday: 1, hour: 2, minute: 0 }),
    ).toBe(0);
  });

  it("scales by the base unit for intervals > 1", () => {
    expect(intervalToDays({ frequency: "daily", interval: 3, hour: 2, minute: 0 })).toBe(3);
    expect(
      intervalToDays({ frequency: "weekly", interval: 2, weekday: 1, hour: 2, minute: 0 }),
    ).toBe(14);
    expect(intervalToDays({ frequency: "monthly", interval: 2, day: 1, hour: 2, minute: 0 })).toBe(
      56,
    );
  });
});

describe("describeSchedule", () => {
  it("describes a daily schedule", () => {
    expect(describeSchedule({ frequency: "daily", interval: 1, hour: 2, minute: 0 })).toBe(
      "Every day at 02:00",
    );
  });

  it("describes a weekly schedule by weekday name", () => {
    expect(
      describeSchedule({ frequency: "weekly", interval: 1, weekday: 1, hour: 2, minute: 0 }),
    ).toBe("Every Monday at 02:00");
  });

  it("describes a monthly schedule with an ordinal day", () => {
    expect(
      describeSchedule({ frequency: "monthly", interval: 1, day: 1, hour: 9, minute: 5 }),
    ).toBe("On day 1 of every month at 09:05");
  });

  it("describes intervals greater than 1", () => {
    expect(describeSchedule({ frequency: "daily", interval: 2, hour: 2, minute: 0 })).toBe(
      "Every 2 days at 02:00",
    );
    expect(
      describeSchedule({ frequency: "weekly", interval: 2, weekday: 1, hour: 2, minute: 0 }),
    ).toBe("Every 2 weeks on Monday at 02:00");
    expect(
      describeSchedule({ frequency: "monthly", interval: 3, day: 1, hour: 9, minute: 5 }),
    ).toBe("On day 1 every 3 months at 09:05");
  });
});

describe("WEEKDAYS", () => {
  it("maps 0..6 to Sunday..Saturday", () => {
    expect(WEEKDAYS).toHaveLength(7);
    expect(WEEKDAYS[0]).toBe("Sunday");
    expect(WEEKDAYS[6]).toBe("Saturday");
  });
});
