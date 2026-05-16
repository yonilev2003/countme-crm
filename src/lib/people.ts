import { z } from "zod";

export type PersonStatus = "lead" | "active" | "inactive" | "partner";

export const PERSON_STATUSES: PersonStatus[] = [
  "lead",
  "active",
  "inactive",
  "partner",
];

export const STATUS_LABELS_HE: Record<PersonStatus, string> = {
  lead: "ליד",
  active: "פעיל",
  inactive: "לא פעיל",
  partner: "שותף",
};

export const STATUS_COLORS: Record<
  PersonStatus,
  { bg: string; text: string; ring?: string }
> = {
  lead: { bg: "bg-amber-100", text: "text-amber-800" },
  active: { bg: "bg-emerald-100", text: "text-emerald-800" },
  inactive: { bg: "bg-slate-100", text: "text-slate-700" },
  partner: { bg: "bg-brand-100", text: "text-brand-800" },
};

// Trim then either return undefined (empty) or the trimmed value
const optionalTrimmedString = (max: number) =>
  z
    .string()
    .max(max, `עד ${max} תווים`)
    .optional()
    .transform((v) => {
      if (v === undefined || v === null) return undefined;
      const trimmed = v.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    });

const optionalEmail = z
  .string()
  .max(200, "עד 200 תווים")
  .optional()
  .transform((v) => {
    if (v === undefined || v === null) return undefined;
    const trimmed = v.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  })
  .refine(
    (v) => v === undefined || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    { message: "כתובת אימייל לא תקינה" },
  );

export const personSchema = z.object({
  name: z
    .string()
    .min(2, "שם חייב להכיל לפחות 2 תווים")
    .max(120, "עד 120 תווים")
    .transform((v) => v.trim()),
  email: optionalEmail,
  phone: optionalTrimmedString(50),
  company: optionalTrimmedString(120),
  role: optionalTrimmedString(120),
  status: z.enum(["lead", "active", "inactive", "partner"]),
  tags: z
    .array(z.string().min(1).max(40))
    .max(40, "עד 40 תיוגים")
    .default([]),
  notes: z
    .string()
    .max(5000, "עד 5000 תווים")
    .optional()
    .transform((v) => {
      if (v === undefined || v === null) return undefined;
      const trimmed = v.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    }),
});

export type PersonInput = z.infer<typeof personSchema>;

// Database row shape (from `people` table)
export type Person = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  status: PersonStatus;
  tags: string[];
  notes: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

// Profile shape used for owner lookup in lists
export type OwnerProfile = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export function parseTagsInput(raw: string): string[] {
  return raw
    .split(/[,\s]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, 40);
}

export function ownerDisplayName(p: OwnerProfile | undefined | null): string {
  if (!p) return "—";
  return p.display_name?.trim() || p.full_name?.trim() || "—";
}

export function initialsOf(text: string | null | undefined): string {
  const source = (text ?? "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/u).slice(0, 2);
  return parts
    .map((s) => Array.from(s)[0] ?? "")
    .filter(Boolean)
    .join("")
    .toUpperCase();
}
