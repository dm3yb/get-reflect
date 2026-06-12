/** A 1Password vault as returned by `op vault list`. */
export type OpVault = {
  id: string;
  name: string;
};

/** Summary of a 1Password item as returned by `op item list`. */
export type OpItemSummary = {
  id: string;
  title: string;
  tags?: string[];
  version: number;
  vault: { id: string; name: string };
  category: string;
  urls?: { label: string; primary: boolean; href: string }[];
  created_at: string;
  updated_at: string;
};

/** A single field within a 1Password item. */
export type OpField = {
  id: string;
  type: string;
  purpose?: string;
  label: string;
  value?: string;
  section?: { id: string; label?: string };
};

/** Full detail of a 1Password item as returned by `op item get`. */
export type OpItemDetail = OpItemSummary & {
  fields?: OpField[];
  sections?: { id: string; label?: string }[];
  favorite?: boolean;
  state?: string;
};

/** A single row in the exported TSV file, matching 1Password's native CSV format. */
export type CsvRow = {
  Title: string;
  Url: string;
  Username: string;
  Password: string;
  OTPAuth: string;
  Favorite: string;
  Archived: string;
  Tags: string;
  Notes: string;
};
