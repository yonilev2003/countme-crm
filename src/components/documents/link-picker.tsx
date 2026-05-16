"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown, Link2, User, Briefcase, X } from "lucide-react";

export type LinkTarget =
  | { kind: "none" }
  | { kind: "person"; id: string; name: string }
  | { kind: "project"; id: string; name: string };

export type PersonOption = { id: string; name: string };
export type ProjectOption = { id: string; name: string };

type Props = {
  people: PersonOption[];
  projects: ProjectOption[];
  value: LinkTarget;
  onChange: (next: LinkTarget) => void;
};

type Segment = "none" | "person" | "project";

export function LinkPicker({ people, projects, value, onChange }: Props) {
  const baseId = useId();
  const [segment, setSegment] = useState<Segment>(value.kind);
  const [open, setOpen] = useState(false);

  const peopleSorted = useMemo(
    () => [...people].sort((a, b) => a.name.localeCompare(b.name, "he")),
    [people],
  );
  const projectsSorted = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name, "he")),
    [projects],
  );

  const label =
    value.kind === "none"
      ? "לא מקושר"
      : value.kind === "person"
        ? `איש: ${value.name}`
        : `פרויקט: ${value.name}`;

  function pick(next: LinkTarget) {
    onChange(next);
    setSegment(next.kind);
    setOpen(false);
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-brand-300 hover:bg-brand-50"
      >
        <Link2 className="h-4 w-4 text-brand-500" />
        <span className="max-w-[16rem] truncate">{label}</span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="קישור מסמך"
          className="absolute z-20 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
          style={{ insetInlineStart: 0 }}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium text-slate-900">קישור ל...</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="סגור"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
            <SegmentButton
              active={segment === "none"}
              onClick={() => setSegment("none")}
            >
              ללא
            </SegmentButton>
            <SegmentButton
              active={segment === "person"}
              onClick={() => setSegment("person")}
            >
              איש
            </SegmentButton>
            <SegmentButton
              active={segment === "project"}
              onClick={() => setSegment("project")}
            >
              פרויקט
            </SegmentButton>
          </div>

          {segment === "none" && (
            <button
              type="button"
              onClick={() => pick({ kind: "none" })}
              className="flex w-full items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800"
            >
              <Link2 className="h-4 w-4" />
              ללא קישור
            </button>
          )}

          {segment === "person" && (
            <OptionList
              listId={`${baseId}-people`}
              icon={<User className="h-4 w-4 text-brand-500" />}
              items={peopleSorted}
              emptyLabel="אין אנשים עדיין"
              onPick={(item) =>
                pick({ kind: "person", id: item.id, name: item.name })
              }
              selectedId={value.kind === "person" ? value.id : null}
            />
          )}

          {segment === "project" && (
            <OptionList
              listId={`${baseId}-projects`}
              icon={<Briefcase className="h-4 w-4 text-brand-500" />}
              items={projectsSorted}
              emptyLabel="אין פרויקטים עדיין"
              onPick={(item) =>
                pick({ kind: "project", id: item.id, name: item.name })
              }
              selectedId={value.kind === "project" ? value.id : null}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-md bg-white px-2 py-1.5 text-xs font-semibold text-brand-700 shadow-sm"
          : "rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
      }
    >
      {children}
    </button>
  );
}

function OptionList({
  listId,
  icon,
  items,
  emptyLabel,
  selectedId,
  onPick,
}: {
  listId: string;
  icon: React.ReactNode;
  items: { id: string; name: string }[];
  emptyLabel: string;
  selectedId: string | null;
  onPick: (item: { id: string; name: string }) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <div>
      <input
        id={listId}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="חיפוש..."
        className="mb-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
      />
      <div className="max-h-56 overflow-auto">
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-slate-500">
            {items.length === 0 ? emptyLabel : "לא נמצאו תוצאות"}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((item) => {
              const selected = item.id === selectedId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onPick(item)}
                    className={
                      selected
                        ? "flex w-full items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-start text-sm font-medium text-brand-800"
                        : "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm text-slate-700 hover:bg-slate-50"
                    }
                  >
                    {icon}
                    <span className="truncate">{item.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
