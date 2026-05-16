"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Plus } from "lucide-react";
import { formatRelative } from "date-fns";
import { he } from "date-fns/locale";
import {
  PERSON_STATUSES,
  STATUS_LABELS_HE,
  initialsOf,
  ownerDisplayName,
  type OwnerProfile,
  type Person,
  type PersonStatus,
} from "@/lib/people";
import { cn } from "@/lib/utils";
import { PeopleStatusBadge } from "./people-status-badge";
import { PeopleTags } from "./people-tags";

type SortKey = "name" | "status" | "updated_at";
type SortDir = "asc" | "desc";

type Props = {
  people: Person[];
  currentUserId: string;
  profiles: OwnerProfile[];
};

export function PeopleTable({ people, profiles }: Props) {
  const [query, setQuery] = useState("");
  const [activeStatuses, setActiveStatuses] = useState<Set<PersonStatus>>(
    () => new Set(PERSON_STATUSES),
  );
  const [activeOwners, setActiveOwners] = useState<Set<string>>(
    () => new Set(profiles.map((p) => p.id)),
  );
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const ownersById = useMemo(() => {
    const map = new Map<string, OwnerProfile>();
    for (const p of profiles) map.set(p.id, p);
    return map;
  }, [profiles]);

  // Only show owner-filter chips for profiles that actually own ≥1 person
  const ownersWithPeople = useMemo(() => {
    const ids = new Set(people.map((p) => p.owner_id));
    return profiles.filter((p) => ids.has(p.id));
  }, [people, profiles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((p) => {
      if (!activeStatuses.has(p.status)) return false;
      if (ownersWithPeople.length > 0 && !activeOwners.has(p.owner_id)) {
        return false;
      }
      if (!q) return true;
      const hay = [
        p.name,
        p.email ?? "",
        p.phone ?? "",
        p.company ?? "",
        p.role ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [people, query, activeStatuses, activeOwners, ownersWithPeople]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name, "he");
      } else if (sortKey === "status") {
        cmp = a.status.localeCompare(b.status);
      } else {
        cmp =
          new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  function toggleStatus(s: PersonStatus) {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) {
        if (next.size === 1) return prev; // never empty
        next.delete(s);
      } else {
        next.add(s);
      }
      return next;
    });
  }

  function toggleOwner(id: string) {
    setActiveOwners((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "updated_at" ? "desc" : "asc");
    }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-brand-700" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-brand-700" />
    );
  }

  const noPeopleAtAll = people.length === 0;
  const noResultsAfterFilter = !noPeopleAtAll && sorted.length === 0;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי שם, אימייל, טלפון, חברה..."
            className="block w-full rounded-lg border border-slate-200 bg-white py-2 ps-9 pe-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">סטטוס:</span>
          {PERSON_STATUSES.map((s) => {
            const active = activeStatuses.has(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatus(s)}
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition",
                  active
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                {STATUS_LABELS_HE[s]}
              </button>
            );
          })}
        </div>

        {ownersWithPeople.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">בעלים:</span>
            {ownersWithPeople.map((owner) => {
              const active = activeOwners.has(owner.id);
              const display = ownerDisplayName(owner);
              return (
                <button
                  key={owner.id}
                  type="button"
                  onClick={() => toggleOwner(owner.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium transition",
                    active
                      ? "border-brand-500 bg-brand-50 text-brand-800"
                      : "border-slate-200 bg-white text-slate-500 opacity-60 hover:opacity-100",
                  )}
                  title={display}
                >
                  <OwnerAvatar owner={owner} size="xs" />
                  <span className="max-w-[8rem] truncate">{display}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Table / states */}
      {noPeopleAtAll ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-start font-medium">
                  <SortHeader
                    label="שם"
                    onClick={() => toggleSort("name")}
                    icon={sortIcon("name")}
                  />
                </th>
                <th className="px-4 py-3 text-start font-medium">חברה</th>
                <th className="px-4 py-3 text-start font-medium">תפקיד</th>
                <th className="px-4 py-3 text-start font-medium">
                  <SortHeader
                    label="סטטוס"
                    onClick={() => toggleSort("status")}
                    icon={sortIcon("status")}
                  />
                </th>
                <th className="px-4 py-3 text-start font-medium">תיוגים</th>
                <th className="px-4 py-3 text-start font-medium">בעלים</th>
                <th className="px-4 py-3 text-start font-medium">
                  <SortHeader
                    label="עודכן"
                    onClick={() => toggleSort("updated_at")}
                    icon={sortIcon("updated_at")}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((person) => {
                const owner = ownersById.get(person.owner_id);
                return (
                  <tr
                    key={person.id}
                    className="border-t border-slate-100 transition hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/people/${person.id}`}
                        className="font-medium text-slate-900 hover:text-brand-700"
                      >
                        {person.name}
                      </Link>
                      {person.email && (
                        <div
                          className="mt-0.5 truncate text-xs text-slate-500"
                          dir="ltr"
                          style={{ maxWidth: "16rem" }}
                        >
                          {person.email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {person.company ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {person.role ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <PeopleStatusBadge status={person.status} />
                    </td>
                    <td className="px-4 py-3">
                      <PeopleTags tags={person.tags} max={3} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <OwnerAvatar owner={owner} size="sm" />
                        <span className="text-xs text-slate-600">
                          {ownerDisplayName(owner)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <RelativeDate iso={person.updated_at} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {noResultsAfterFilter && (
            <div className="border-t border-slate-100 px-4 py-12 text-center text-sm text-slate-500">
              לא נמצאו תוצאות עבור החיפוש או הסינון
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SortHeader({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-start font-medium text-slate-600 hover:text-slate-900"
    >
      {label}
      {icon}
    </button>
  );
}

function OwnerAvatar({
  owner,
  size = "sm",
}: {
  owner: OwnerProfile | undefined | null;
  size?: "xs" | "sm";
}) {
  const dim =
    size === "xs" ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs";
  const initials = initialsOf(ownerDisplayName(owner));
  if (owner?.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={owner.avatar_url}
        alt=""
        className={cn(
          "shrink-0 rounded-full border border-slate-200 object-cover",
          dim,
        )}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700",
        dim,
      )}
    >
      {initials}
    </div>
  );
}

function RelativeDate({ iso }: { iso: string }) {
  // Defer to client to avoid hydration mismatch (the "now" reference shifts
  // between server render and client hydration).
  const [text, setText] = useState<string>("");
  useEffect(() => {
    try {
      const date = new Date(iso);
      setText(
        formatRelative(date, new Date(), {
          locale: he,
          weekStartsOn: 0,
        }),
      );
    } catch {
      setText("—");
    }
  }, [iso]);
  // Render a stable date string as SSR fallback so the column isn't empty.
  const fallback = (() => {
    try {
      return new Date(iso).toLocaleDateString("he-IL");
    } catch {
      return "—";
    }
  })();
  return <span suppressHydrationWarning>{text || fallback}</span>;
}

function EmptyState() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
      <h2 className="text-xl font-bold text-slate-900">אין עדיין אנשי קשר</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        זה המקום לרכז את כל מי שהצוות עובד מולו — לידים, שותפים, לקוחות.
      </p>
      <Link
        href="/people/new"
        className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
      >
        <Plus className="h-4 w-4" />
        הוסף איש קשר
      </Link>
    </div>
  );
}
