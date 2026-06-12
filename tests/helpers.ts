/* Shared test fixtures. */

import type { OpItemDetail, OpItemSummary, OpVault } from "../src/types.js";

/** Build a minimal item summary, as returned by `op item list`. */
export function makeItemSummary(
  id: string,
  title: string,
  vault: OpVault = { id: "v1", name: "Vault" },
): OpItemSummary {
  return {
    id,
    title,
    version: 1,
    category: "LOGIN",
    vault,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

/** A fully-populated OpItemDetail for use across test files. */
export const sampleItem: OpItemDetail = {
  id: "item-1",
  title: "My Login",
  category: "LOGIN",
  version: 1,
  vault: { id: "vault-1", name: "Personal" },
  urls: [
    { label: "website", primary: true, href: "https://example.com" },
    { label: "other", primary: false, href: "https://other.com" },
  ],
  tags: ["work", "important"],
  favorite: true,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  fields: [
    { id: "f1", type: "STRING", purpose: "USERNAME", label: "username", value: "user@example.com" },
    { id: "f2", type: "CONCEALED", purpose: "PASSWORD", label: "password", value: "s3cret" },
    { id: "f3", type: "STRING", purpose: "NOTES", label: "notesPlain", value: "Some notes here" },
    {
      id: "f4",
      type: "OTP",
      label: "one-time password",
      value: "otpauth://totp/example?secret=ABC123",
    },
  ],
};
