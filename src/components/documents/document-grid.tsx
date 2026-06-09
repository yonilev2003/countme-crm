"use client";

import { useMemo, useState } from "react";
import { ArrowUp, Search, FilterX } from "lucide-react";
import { DocumentCard, type DocumentRow, type OwnerInfo } from "./document-card";
import type { PersonOption, ProjectOption } from "./link-picker";

type Props = {
  documents: DocumentRow[];
  owners: OwnerInfo[];
  people: PersonOption[];
  projects: ProjectOption[];
  currentUserId: string | null;
  driveConnected: boolean;
};

const NONE = "__none__";
const ALL = "__all__";

export function DocumentGrid({
  documents,
  owners,
  people,
  projects,
  currentUserId,
  driveConnected,
}: Props) {
  const [personFilter, setPersonFilter] = useState<string>(ALL);
  const [projectFilter, setProjectFilter] = useState<string>(ALL);
  const [query, setQuery] = useState("");

  const ownerById = useMemo(() => {
    const map = new Map<string, OwnerInfo>();
    for (const o of owners) map.set(o.id, o);
    return map;
  }, [owners]);

  const personById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of people) map.set(p.id, p.name);
    return map;
  }, [people]);

  const projectById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.id, p.name);
    return map;
  }, [projects]);

  const peopleSorted = useMemo(
    () => [...people].sort((a, b) => a.name.localeCompare(b.name, "he")),
    [people],
  );
  const projectsSorted = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name, "he")),
    [projects],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((d) => {
      if (personFilter !== ALL) {
        if (personFilter === NONE) {
          if (d.person_id) return false;
        } else if (d.person_id !== personFilter) {
          return false;
        }
      }
      if (projectFilter !== ALL) {
        if (projectFilter === NONE) {
          if (d.project_id) return false;
        } else if (d.project_id !== projectFilter) {
          return false;
        }
      }
      if (q && !d.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [documents, personFilter, projectFilter, query]);

  const filtersActive =
    personFilter !== ALL || projectFilter !== ALL || query.trim() !== "";

  function resetFilters() {
    setPersonFilter(ALL);
    setProjectFilter(ALL);
    setQuery("");
  }

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" style={{ insetInlineStart: "0.75rem" }} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי שם קובץ..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
            style={{ paddingInlineStart: "2.25rem", paddingInlineEnd: "0.75rem" }}
          />
        </div>

        <select
          value={personFilter}
          onChange={(e) => setPersonFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value={ALL}>כל האנשים</option>
          <option value={NONE}>ללא איש</option>
          {peopleSorted.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value={ALL}>כל הפרויקטים</option>
          <option value={NONE}>ללא פרויקט</option>
          {projectsSorted.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {filtersActive && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <FilterX className="h-4 w-4" />
            נקה סינון
          </button>
        )}
      </div>

      <div className="mb-3 text-xs text-slate-500">
        מציג {filtered.length} מתוך {documents.length} מסמכים
      </div>

      {filtered.length === 0 ? (
        <EmptyState filtered={filtersActive && documents.length > 0} />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              owner={ownerById.get(doc.owner_id) ?? null}
              currentUserId={currentUserId}
              driveConnected={driveConnected}
              personName={doc.person_id ? personById.get(doc.person_id) ?? null : null}
              projectName={
                doc.project_id ? projectById.get(doc.project_id) ?? null : null
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  if (filtered) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <div className="font-display text-lg font-bold text-slate-900">
          אין תוצאות
        </div>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
          נסה לשנות את הסינון או החיפוש.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <ArrowUp className="h-5 w-5" />
      </div>
      <div className="font-display text-lg font-bold text-slate-900">
        עדיין אין מסמכים
      </div>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
        העלה את המסמך הראשון בעזרת אזור ההעלאה שלמעלה.
      </p>
    </div>
  );
}
