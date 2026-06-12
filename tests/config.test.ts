import { beforeEach, describe, expect, it, vi } from "vitest";
import { join } from "node:path";
import { defaultBackupRoot, getBackupRoot, getIntervalDays, loadConfig } from "../src/config.js";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.HOME = "/Users/test";
  process.env.OP_SERVICE_ACCOUNT_TOKEN = "test-token";
  delete process.env.BACKUP_PATH;
  delete process.env.BACKUP_INTERVAL_DAYS;
});

describe("getBackupRoot", () => {
  it("returns the iCloud default when BACKUP_PATH is unset", () => {
    expect(getBackupRoot()).toBe(defaultBackupRoot());
    expect(getBackupRoot()).toContain("com~apple~CloudDocs");
  });

  it("returns BACKUP_PATH when set", () => {
    process.env.BACKUP_PATH = "/Volumes/Backups/1password";
    expect(getBackupRoot()).toBe("/Volumes/Backups/1password");
  });

  it("expands a leading ~ to the home directory", () => {
    process.env.BACKUP_PATH = "~/backups/1password";
    expect(getBackupRoot()).toBe(join("/Users/test", "backups/1password"));
  });

  it("trims surrounding whitespace", () => {
    process.env.BACKUP_PATH = "  /tmp/backups  ";
    expect(getBackupRoot()).toBe("/tmp/backups");
  });
});

describe("getIntervalDays", () => {
  it("returns 0 when BACKUP_INTERVAL_DAYS is unset", () => {
    expect(getIntervalDays()).toBe(0);
  });

  it("returns the configured number of days", () => {
    process.env.BACKUP_INTERVAL_DAYS = "14";
    expect(getIntervalDays()).toBe(14);
  });

  it("returns 0 for non-positive or non-numeric values", () => {
    process.env.BACKUP_INTERVAL_DAYS = "0";
    expect(getIntervalDays()).toBe(0);
    process.env.BACKUP_INTERVAL_DAYS = "-5";
    expect(getIntervalDays()).toBe(0);
    process.env.BACKUP_INTERVAL_DAYS = "abc";
    expect(getIntervalDays()).toBe(0);
  });
});

describe("loadConfig", () => {
  it("throws if OP_SERVICE_ACCOUNT_TOKEN is missing", () => {
    delete process.env.OP_SERVICE_ACCOUNT_TOKEN;
    expect(() => loadConfig()).toThrow("OP_SERVICE_ACCOUNT_TOKEN");
  });

  it("throws if HOME is missing", () => {
    delete process.env.HOME;
    expect(() => loadConfig()).toThrow("HOME");
  });

  it("does not throw when the required env vars are set", () => {
    expect(() => loadConfig()).not.toThrow();
  });
});
