import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/utils/exec.js", () => ({
  execFileAsync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  copyFile: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  chmod: vi.fn(async () => undefined),
}));

import { chmod, copyFile, mkdir } from "node:fs/promises";
import { parse as parsePlist } from "plist";
import { buildPlist, installAgent, scheduleToCalendarInterval } from "../../src/setup/launchd.js";
import { execFileAsync } from "../../src/utils/exec.js";

const mockedExecFileAsync = vi.mocked(execFileAsync);

const PLIST_OPTS = {
  label: "com.user.get-reflect",
  nodePath: "/opt/homebrew/bin/node",
  workingDir: "/Users/test/Developer/get-reflect",
  scriptPath: "/Users/test/Developer/get-reflect/src/index.ts",
  envFile: ".env",
  calendarInterval: { Weekday: 1, Hour: 2, Minute: 0 },
  logPath: "/Users/test/Library/Logs/get-reflect.log",
  pathEnv: "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.HOME = "/Users/test";
});

describe("buildPlist", () => {
  it("builds a plist with the injected values", () => {
    const parsed = parsePlist(buildPlist(PLIST_OPTS)) as Record<string, unknown>;

    expect(parsed.Label).toBe("com.user.get-reflect");
    expect(parsed.WorkingDirectory).toBe("/Users/test/Developer/get-reflect");
    expect(parsed.ProgramArguments).toEqual([
      "/opt/homebrew/bin/node",
      "--import",
      "tsx/esm",
      "--env-file=.env",
      "/Users/test/Developer/get-reflect/src/index.ts",
      "--scheduled",
    ]);
    expect(parsed.EnvironmentVariables).toEqual({
      PATH: "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
    });
    expect(parsed.StandardOutPath).toBe("/Users/test/Library/Logs/get-reflect.log");
    expect(parsed.StandardErrorPath).toBe("/Users/test/Library/Logs/get-reflect.log");
  });

  it("renders the calendar interval it is given", () => {
    const parsed = parsePlist(buildPlist(PLIST_OPTS)) as Record<string, unknown>;
    expect(parsed.StartCalendarInterval).toEqual({ Weekday: 1, Hour: 2, Minute: 0 });
  });

  it("omits Weekday/Day for a daily interval", () => {
    const parsed = parsePlist(
      buildPlist({ ...PLIST_OPTS, calendarInterval: { Hour: 6, Minute: 30 } }),
    ) as Record<string, unknown>;
    expect(parsed.StartCalendarInterval).toEqual({ Hour: 6, Minute: 30 });
  });

  it("escapes XML-special characters so the document still parses", () => {
    const parsed = parsePlist(
      buildPlist({ ...PLIST_OPTS, workingDir: "/Users/a&b/<dir>" }),
    ) as Record<string, unknown>;
    expect(parsed.WorkingDirectory).toBe("/Users/a&b/<dir>");
  });
});

describe("scheduleToCalendarInterval", () => {
  it("daily → Hour + Minute only", () => {
    expect(
      scheduleToCalendarInterval({ frequency: "daily", interval: 1, hour: 2, minute: 0 }),
    ).toEqual({ Hour: 2, Minute: 0 });
  });

  it("weekly → Weekday + Hour + Minute", () => {
    expect(
      scheduleToCalendarInterval({
        frequency: "weekly",
        interval: 1,
        weekday: 1,
        hour: 2,
        minute: 0,
      }),
    ).toEqual({ Weekday: 1, Hour: 2, Minute: 0 });
  });

  it("monthly → Day + Hour + Minute", () => {
    expect(
      scheduleToCalendarInterval({
        frequency: "monthly",
        interval: 1,
        day: 15,
        hour: 6,
        minute: 30,
      }),
    ).toEqual({ Day: 15, Hour: 6, Minute: 30 });
  });

  it("ignores interval (cadence stays at the base unit)", () => {
    expect(
      scheduleToCalendarInterval({
        frequency: "weekly",
        interval: 2,
        weekday: 1,
        hour: 2,
        minute: 0,
      }),
    ).toEqual({ Weekday: 1, Hour: 2, Minute: 0 });
  });
});

describe("installAgent", () => {
  it("copies the plist into LaunchAgents, tightens its mode, and reloads it", async () => {
    mockedExecFileAsync.mockResolvedValue({ stdout: "", stderr: "" });

    const dest = await installAgent("/repo/launchd/com.user.get-reflect.plist", PLIST_OPTS.label);

    expect(dest).toBe("/Users/test/Library/LaunchAgents/com.user.get-reflect.plist");
    expect(mkdir).toHaveBeenCalledWith("/Users/test/Library/LaunchAgents", { recursive: true });
    expect(copyFile).toHaveBeenCalledWith("/repo/launchd/com.user.get-reflect.plist", dest);
    expect(chmod).toHaveBeenCalledWith(dest, 0o600);
    expect(mockedExecFileAsync).toHaveBeenCalledWith("launchctl", ["unload", dest]);
    expect(mockedExecFileAsync).toHaveBeenCalledWith("launchctl", ["load", dest]);
  });

  it("tolerates a failing unload (agent not yet loaded) and still loads", async () => {
    /* unload runs first and fails; the subsequent load succeeds. */
    mockedExecFileAsync
      .mockRejectedValueOnce(new Error("Could not find specified service"))
      .mockResolvedValueOnce({ stdout: "", stderr: "" });

    await expect(
      installAgent("/repo/launchd/com.user.get-reflect.plist", PLIST_OPTS.label),
    ).resolves.toBeDefined();

    expect(mockedExecFileAsync).toHaveBeenCalledWith("launchctl", ["load", expect.any(String)]);
  });
});
