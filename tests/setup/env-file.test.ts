import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn(async () => undefined),
  chmod: vi.fn(async () => undefined),
}));

import { chmod, writeFile } from "node:fs/promises";
import { renderEnvFile, writeEnvFile } from "../../src/setup/env-file.js";

const VALUES = {
  token: "ops_abc123",
  backupPath: "/Users/me/backups",
  intervalDays: 14,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("renderEnvFile", () => {
  it("includes all keys with their values", () => {
    const contents = renderEnvFile(VALUES);

    expect(contents).toContain("OP_SERVICE_ACCOUNT_TOKEN=ops_abc123");
    expect(contents).toContain("BACKUP_PATH=/Users/me/backups");
    expect(contents).toContain("BACKUP_INTERVAL_DAYS=14");
  });

  it("ends with a trailing newline", () => {
    expect(renderEnvFile({ ...VALUES, intervalDays: 0 }).endsWith("\n")).toBe(true);
  });
});

describe("writeEnvFile", () => {
  it("writes owner-only and re-tightens the mode", async () => {
    await writeEnvFile("/repo/.env", VALUES);

    expect(writeFile).toHaveBeenCalledWith("/repo/.env", expect.any(String), { mode: 0o600 });
    expect(chmod).toHaveBeenCalledWith("/repo/.env", 0o600);

    const written = vi.mocked(writeFile).mock.calls[0][1];
    expect(written).toContain("OP_SERVICE_ACCOUNT_TOKEN=ops_abc123");
  });
});
