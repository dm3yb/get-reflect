import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
}));

vi.mock("path-exists", () => ({
  pathExists: vi.fn(),
}));

import { mkdir } from "node:fs/promises";
import { pathExists } from "path-exists";
import { sanitizeVaultName, getBackupDir } from "../../src/utils/fs.js";

const mockedPathExists = vi.mocked(pathExists);
const mockedMkdir = vi.mocked(mkdir);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.HOME = "/Users/test";
});

describe("sanitizeVaultName", () => {
  it("converts spaces and special chars to hyphens, lowercased", () => {
    expect(sanitizeVaultName("My Personal Vault!")).toBe("my-personal-vault");
  });

  it("collapses consecutive hyphens", () => {
    expect(sanitizeVaultName("Vault---Name")).toBe("vault-name");
  });

  it("trims leading and trailing hyphens", () => {
    expect(sanitizeVaultName("!Hello World!")).toBe("hello-world");
  });
});

describe("getBackupDir", () => {
  it("returns correct date-based path when dir does not exist", async () => {
    mockedPathExists.mockResolvedValue(false);
    mockedMkdir.mockResolvedValue(undefined);

    const result = await getBackupDir("My Vault", "2026-03-14");
    expect(result).toBe(
      "/Users/test/Library/Mobile Documents/com~apple~CloudDocs/Documents/security/get-reflect-backups/2026-03-14/my-vault",
    );
    expect(mockedMkdir).toHaveBeenCalledWith(result, { recursive: true, mode: 0o700 });
  });

  it("appends timestamp suffix when dir already exists", async () => {
    mockedPathExists.mockResolvedValue(true);
    mockedMkdir.mockResolvedValue(undefined);

    const result = await getBackupDir("My Vault", "2026-03-14");
    expect(result).toMatch(
      /\/Users\/test\/Library\/Mobile Documents\/com~apple~CloudDocs\/Documents\/security\/get-reflect-backups\/2026-03-14\/my-vault-\d{6}$/,
    );
  });
});
