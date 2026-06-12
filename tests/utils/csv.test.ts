import { describe, it, expect } from "vitest";
import { flattenItemToCsvRow, itemsToCsv } from "../../src/utils/csv.js";
import { sampleItem } from "../helpers.js";
import type { OpItemDetail } from "../../src/types.js";

describe("flattenItemToCsvRow", () => {
  it("extracts username, password, and notes by purpose", () => {
    const row = flattenItemToCsvRow(sampleItem);
    expect(row.Username).toBe("user@example.com");
    expect(row.Password).toBe("s3cret");
    expect(row.Notes).toBe("Some notes here");
  });

  it("extracts primary URL, falls back to first", () => {
    const row = flattenItemToCsvRow(sampleItem);
    expect(row.Url).toBe("https://example.com");

    const itemNoPrimary: OpItemDetail = {
      ...sampleItem,
      urls: [{ label: "site", primary: false, href: "https://fallback.com" }],
    };
    expect(flattenItemToCsvRow(itemNoPrimary).Url).toBe("https://fallback.com");
  });

  it("returns empty strings for missing optional fields", () => {
    const minimalItem: OpItemDetail = {
      ...sampleItem,
      fields: [],
      urls: undefined,
      tags: undefined,
      favorite: undefined,
    };
    const row = flattenItemToCsvRow(minimalItem);
    expect(row.Username).toBe("");
    expect(row.Password).toBe("");
    expect(row.Url).toBe("");
    expect(row.Notes).toBe("");
    expect(row.Tags).toBe("");
    expect(row.OTPAuth).toBe("");
    expect(row.Favorite).toBe("false");
    expect(row.Archived).toBe("false");
  });

  it("joins tags with semicolons", () => {
    const row = flattenItemToCsvRow(sampleItem);
    expect(row.Tags).toBe("work;important");
  });

  it("extracts TOTP seed from OTP field", () => {
    const row = flattenItemToCsvRow(sampleItem);
    expect(row.OTPAuth).toBe("otpauth://totp/example?secret=ABC123");
  });

  it("sets Favorite and Archived correctly", () => {
    const row = flattenItemToCsvRow(sampleItem);
    expect(row.Favorite).toBe("true");
    expect(row.Archived).toBe("false");

    const archivedItem: OpItemDetail = { ...sampleItem, state: "ARCHIVED", favorite: false };
    const archivedRow = flattenItemToCsvRow(archivedItem);
    expect(archivedRow.Favorite).toBe("false");
    expect(archivedRow.Archived).toBe("true");
  });
});

describe("itemsToCsv", () => {
  it("produces correct tab-separated header and data rows", () => {
    const csv = itemsToCsv([sampleItem]);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe(
      "Title\tUrl\tUsername\tPassword\tOTPAuth\tFavorite\tArchived\tTags\tNotes",
    );
    expect(lines[1]).toContain("My Login");
    expect(lines[1]).toContain("user@example.com");
    expect(lines[1].split("\t")).toHaveLength(9);
  });

  it("returns header-only for empty array", () => {
    const csv = itemsToCsv([]);
    expect(csv.trim()).toBe(
      "Title\tUrl\tUsername\tPassword\tOTPAuth\tFavorite\tArchived\tTags\tNotes",
    );
  });
});
