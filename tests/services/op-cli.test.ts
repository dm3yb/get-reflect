import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/utils/exec.js", () => ({
  execFileAsync: vi.fn(),
}));

import { execOp, listVaults, listItems, getItem } from "../../src/services/op-cli.js";
import { execFileAsync } from "../../src/utils/exec.js";
import { sampleItem } from "../helpers.js";

const mockedExecFileAsync = vi.mocked(execFileAsync);

function mockStdout(stdout: string) {
  mockedExecFileAsync.mockResolvedValue({ stdout, stderr: "" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("execOp", () => {
  it("appends --cache and sets a generous maxBuffer", async () => {
    mockStdout('{"result": true}');

    await execOp(["vault", "list", "--format", "json"]);

    expect(mockedExecFileAsync).toHaveBeenCalledWith(
      "op",
      ["vault", "list", "--format", "json", "--cache"],
      { maxBuffer: 50 * 1_024 * 1_024 },
    );
  });

  it("throws on non-zero exit code", async () => {
    mockedExecFileAsync.mockRejectedValue(new Error("command failed"));

    await expect(execOp(["vault", "list"])).rejects.toThrow("command failed");
  });

  it("passes a token override via the child environment", async () => {
    mockStdout("[]");

    await execOp(["vault", "list"], { token: "ops_test" });

    expect(mockedExecFileAsync).toHaveBeenCalledWith(
      "op",
      ["vault", "list", "--cache"],
      expect.objectContaining({
        env: expect.objectContaining({ OP_SERVICE_ACCOUNT_TOKEN: "ops_test" }),
      }),
    );
  });

  it("explains how to install op when the binary is missing", async () => {
    mockedExecFileAsync.mockRejectedValue(
      Object.assign(new Error("spawn op ENOENT"), { code: "ENOENT" }),
    );

    await expect(execOp(["vault", "list"])).rejects.toThrow("brew install 1password-cli");
  });
});

describe("listVaults", () => {
  it("parses JSON output", async () => {
    const vaults = [
      { id: "v1", name: "Personal" },
      { id: "v2", name: "Work" },
    ];
    mockStdout(JSON.stringify(vaults));

    const result = await listVaults();
    expect(result).toEqual(vaults);
  });
});

describe("listItems", () => {
  it("passes vault ID correctly", async () => {
    mockStdout("[]");

    await listItems("vault-123");

    expect(mockedExecFileAsync).toHaveBeenCalledWith(
      "op",
      ["item", "list", "--vault", "vault-123", "--format", "json", "--cache"],
      expect.any(Object),
    );
  });
});

describe("getItem", () => {
  it("passes item and vault IDs correctly", async () => {
    mockStdout(JSON.stringify(sampleItem));

    await getItem("item-1", "vault-1");

    expect(mockedExecFileAsync).toHaveBeenCalledWith(
      "op",
      ["item", "get", "item-1", "--vault", "vault-1", "--format", "json", "--cache"],
      expect.any(Object),
    );
  });
});
