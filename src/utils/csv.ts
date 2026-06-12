/* Converts 1Password items to tab-separated CSV matching the native export format. */

import Papa from "papaparse";
import type { CsvRow, OpField, OpItemDetail } from "../types.js";

/** Column order matching 1Password's native CSV export. */
const CSV_COLUMNS: (keyof CsvRow)[] = [
  "Title",
  "Url",
  "Username",
  "Password",
  "OTPAuth",
  "Favorite",
  "Archived",
  "Tags",
  "Notes",
];

export function flattenItemToCsvRow(item: OpItemDetail): CsvRow {
  const fields = item.fields ?? [];
  const findField = (predicate: (field: OpField) => boolean) => fields.find(predicate)?.value ?? "";

  return {
    Title: item.title,
    Url: item.urls?.find((url) => url.primary)?.href ?? item.urls?.[0]?.href ?? "",
    Username: findField((field) => field.purpose === "USERNAME"),
    Password: findField((field) => field.purpose === "PASSWORD"),
    OTPAuth: findField((field) => field.type === "OTP"),
    Favorite: item.favorite ? "true" : "false",
    Archived: item.state === "ARCHIVED" ? "true" : "false",
    Tags: (item.tags ?? []).join(";"),
    Notes: findField((field) => field.purpose === "NOTES"),
  };
}

export function itemsToCsv(items: OpItemDetail[]): string {
  if (items.length === 0) {
    return `${CSV_COLUMNS.join("\t")}\n`;
  }
  const csv = Papa.unparse(items.map(flattenItemToCsvRow), {
    delimiter: "\t",
    columns: CSV_COLUMNS,
    newline: "\n",
  });
  return `${csv}\n`;
}
