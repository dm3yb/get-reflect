import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/services/op-cli.js", () => ({
  checkOpCli: vi.fn(),
  listVaults: vi.fn(),
  listItems: vi.fn(),
  getItem: vi.fn(),
}));

vi.mock("../src/utils/fs.js", () => ({
  getBackupDir: vi.fn(),
}));

vi.mock("../src/utils/schedule-gate.js", () => ({
  findLastBackupDate: vi.fn(),
  isBackupDue: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn(),
}));

vi.mock("../src/utils/logger.js", () => ({
  start: vi.fn(),
  step: vi.fn(),
  error: vi.fn(),
  end: vi.fn(),
  spinner: vi.fn(() => ({ message: vi.fn(), stop: vi.fn(), error: vi.fn() })),
  succeedSpinner: vi.fn(),
  run: vi.fn(
    async (_label: string, fn: () => Promise<unknown>, done: (r: unknown) => { msg: string }) => {
      const result = await fn();
      done(result);
      return result;
    },
  ),
  connector: vi.fn(),
  timestamp: vi.fn(() => "2026-03-14 00:00:00"),
}));

import { writeFile } from "node:fs/promises";
import { backupVault, main } from "../src/backup.js";
import { checkOpCli, getItem, listItems, listVaults } from "../src/services/op-cli.js";
import type { OpVault } from "../src/types.js";
import { getBackupDir } from "../src/utils/fs.js";
import { findLastBackupDate, isBackupDue } from "../src/utils/schedule-gate.js";
import { makeItemSummary, sampleItem } from "./helpers.js";

const mockedListItems = vi.mocked(listItems);
const mockedGetItem = vi.mocked(getItem);
const mockedGetBackupDir = vi.mocked(getBackupDir);
const mockedWriteFile = vi.mocked(writeFile);
const mockedCheckOpCli = vi.mocked(checkOpCli);
const mockedListVaults = vi.mocked(listVaults);
const mockedFindLastBackupDate = vi.mocked(findLastBackupDate);
const mockedIsBackupDue = vi.mocked(isBackupDue);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.HOME = "/Users/test";
  process.env.OP_SERVICE_ACCOUNT_TOKEN = "test-token";
});

describe("backupVault", () => {
  it("creates dir and writes backup.json and backup.csv", async () => {
    const vault: OpVault = { id: "v1", name: "Test Vault" };

    mockedListItems.mockResolvedValue([makeItemSummary("i1", "Item 1", vault)]);
    mockedGetItem.mockResolvedValue(sampleItem);
    mockedGetBackupDir.mockResolvedValue("/backups/2026-03-14/test-vault");
    mockedWriteFile.mockResolvedValue(undefined);

    await backupVault(vault, "2026-03-14");

    expect(mockedGetBackupDir).toHaveBeenCalledWith("Test Vault", "2026-03-14");
    expect(mockedWriteFile).toHaveBeenCalledTimes(2);

    const writePaths = mockedWriteFile.mock.calls.map((c) => c[0]);
    expect(writePaths.some((p) => String(p).endsWith("backup.json"))).toBe(true);
    expect(writePaths.some((p) => String(p).endsWith("backup.csv"))).toBe(true);

    /* Both files hold plaintext secrets — must be written owner-only. */
    for (const call of mockedWriteFile.mock.calls) {
      expect(call[2]).toEqual({ mode: 0o600 });
    }
  });

  it("fetches all items concurrently", async () => {
    const vault: OpVault = { id: "v1", name: "Vault" };
    const items = [
      makeItemSummary("i1", "A"),
      makeItemSummary("i2", "B"),
      makeItemSummary("i3", "C"),
    ];

    mockedListItems.mockResolvedValue(items);
    mockedGetItem.mockImplementation(async (itemId) => ({ ...sampleItem, id: itemId }));
    mockedGetBackupDir.mockResolvedValue("/backups/2026-03-14/vault");
    mockedWriteFile.mockResolvedValue(undefined);

    await backupVault(vault, "2026-03-14");

    const getItemCalls = mockedGetItem.mock.calls.map((c) => c[0]);
    expect(getItemCalls.toSorted()).toEqual(["i1", "i2", "i3"]);
  });
});

describe("main", () => {
  it("throws if op CLI is not found", async () => {
    mockedCheckOpCli.mockRejectedValue(new Error("command not found: op"));

    await expect(main()).rejects.toThrow("command not found: op");
  });

  it("skips a scheduled run when the interval has not elapsed", async () => {
    mockedFindLastBackupDate.mockResolvedValue(new Date(2026, 5, 14));
    mockedIsBackupDue.mockReturnValue(false);

    await main({ scheduled: true });

    /* Returned early — never touched the 1Password CLI. */
    expect(mockedCheckOpCli).not.toHaveBeenCalled();
    expect(mockedListVaults).not.toHaveBeenCalled();
  });

  it("proceeds with a scheduled run when due", async () => {
    mockedFindLastBackupDate.mockResolvedValue(new Date(2026, 4, 1));
    mockedIsBackupDue.mockReturnValue(true);
    mockedCheckOpCli.mockResolvedValue("2.30.0");
    mockedListVaults.mockResolvedValue([]);

    await main({ scheduled: true });

    expect(mockedCheckOpCli).toHaveBeenCalled();
    expect(mockedListVaults).toHaveBeenCalled();
  });

  it("ignores the interval gate for manual runs", async () => {
    mockedCheckOpCli.mockResolvedValue("2.30.0");
    mockedListVaults.mockResolvedValue([]);

    await main();

    /* No --scheduled → never consults the gate. */
    expect(mockedIsBackupDue).not.toHaveBeenCalled();
    expect(mockedCheckOpCli).toHaveBeenCalled();
  });
});
