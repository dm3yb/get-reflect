import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs/promises", () => ({
  readdir: vi.fn(),
}));

import { readdir } from "node:fs/promises";
import {
  findLastBackupDate,
  isBackupDue,
  parseLatestBackupDate,
} from "../../src/utils/schedule-gate.js";

const mockedReaddir = vi.mocked(readdir);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("parseLatestBackupDate", () => {
  it("returns the most recent dated folder", () => {
    const result = parseLatestBackupDate(["2026-01-05", "2026-03-14", "2026-02-20"]);
    expect(result).toEqual(new Date(2026, 2, 14));
  });

  it("ignores non-date entries", () => {
    const result = parseLatestBackupDate([".DS_Store", "notes", "2026-06-01", "latest"]);
    expect(result).toEqual(new Date(2026, 5, 1));
  });

  it("returns null when there are no dated folders", () => {
    expect(parseLatestBackupDate([])).toBeNull();
    expect(parseLatestBackupDate(["random", "2026-13-99"])).toBeNull();
  });
});

describe("isBackupDue", () => {
  const now = new Date(2026, 5, 15); /* 2026-06-15 */

  it("is due when interval is 0 (no gating)", () => {
    expect(isBackupDue(new Date(2026, 5, 14), 0, now)).toBe(true);
  });

  it("is due when there is no previous backup", () => {
    expect(isBackupDue(null, 14, now)).toBe(true);
  });

  it("is due once exactly intervalDays have elapsed", () => {
    expect(isBackupDue(new Date(2026, 5, 1), 14, now)).toBe(true); /* 14 days */
  });

  it("is not due before intervalDays have elapsed", () => {
    expect(isBackupDue(new Date(2026, 5, 8), 14, now)).toBe(false); /* 7 days */
  });

  it("every-2-days: skips the in-between day, runs on the second", () => {
    const day1 = new Date(2026, 5, 11);
    expect(isBackupDue(day1, 2, new Date(2026, 5, 12))).toBe(false); /* +1 day */
    expect(isBackupDue(day1, 2, new Date(2026, 5, 13))).toBe(true); /* +2 days */
  });
});

describe("findLastBackupDate", () => {
  it("returns the latest dated directory in the backup root", async () => {
    mockedReaddir.mockResolvedValue([
      { name: "2026-01-01", isDirectory: () => true },
      { name: "2026-06-10", isDirectory: () => true },
      { name: "backup.json", isDirectory: () => false },
    ] as unknown as Awaited<ReturnType<typeof readdir>>);

    const result = await findLastBackupDate("/backups");
    expect(result).toEqual(new Date(2026, 5, 10));
  });

  it("returns null when the backup root does not exist", async () => {
    mockedReaddir.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    expect(await findLastBackupDate("/missing")).toBeNull();
  });
});
