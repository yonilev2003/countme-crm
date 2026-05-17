import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Pencil,
  Mail,
  Phone,
  Building2,
  Briefcase,
  User as UserIcon,
  CalendarDays,
  ChevronRight,
  ListChecks,
  FolderOpen,
  MessageSquare,
  Info,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PeopleStatusBadge } from "@/components/people/people-status-badge";
import { PeopleTags } from "@/components/people/people-tags";
import {
  initialsOf,
  ownerDisplayName,
  type OwnerProfile,
  type Person,
} from "@/lib/people";
import { cn } from "@/lib/utils";
import { DeletePersonButton } from "./delete-person-button";

type TabKey = "info" | "tasks" | "docs" | "chat";
const TAB_KEYS: TabKey[] = ["info", "tasks", "docs", "chat"];

type SearchParamsRecord = Record<string, string | string[] | undefined>;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParamsRecord>;
};

export default async function PersonDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const tabParam = typeof sp.tab === "string" ? sp.tab : "info";
  const tab: TabKey = (TAB_KEYS as string[]).includes(tabParam)
    ? (tabParam as TabKey)
    : "info";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: personRow } = await supabase
    .from("people")
    .select(
      "id, name, email, phone, company, role, status, tags, notes, owner_id, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!personRow) notFound();

  const person = personRow as Person;
  const isOwner = Boolean(user && user.id === person.owner_id);

  const { data: ownerRow } = await supabase
    .from("profiles")
    .select("id, display_name, full_name, avatar_url")
    .eq("id", person.owner_id)
    .maybeSingle();

  const owner = ownerRow as OwnerProfile | null;

  // Load tab-specific data only when needed
  const [tasksRes, docsRes] = await Promise.all([
    tab === "tasks" || tab === "info"
      ? supabase
          .from("tasks")
          .select("id, title, status, priority, due_date, updated_at")
          .eq("person_id", person.id)
          .order("updated_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as TaskRow[] }),
    tab === "docs" || tab === "info"
      ? supabase
          .from("documents")
          .select("id, name, mime_type, size, storage_path, uploaded_at")
          .eq("person_id", person.id)
          .order("uploaded_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as DocRow[] }),
  ]);

  const tasks = (tasksRes.data ?? []) as TaskRow[];
  const docs = (docsRes.data ?? []) as DocRow[];

  return (
    <div className="mx-auto max-w-4xl">
      <nav className="mb-4 flex items-center gap-1 text-sm text-slate-500">
        <Link href="/people" className="hover:text-slate-900">
          אנשי קשר
        </Link>
        <ChevronRight className="h-4 w-4 rotate-180 text-slate-400" />
        <span className="text-slate-900">{person.name}</span>
      </nav>

      {/* Header card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xl font-semibold text-brand-700">
            {initialsOf(person.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-bold text-slate-900">
                {person.name}
              </h1>
              <PeopleStatusBadge status={person.status} />
            </div>
            {(person.company || person.role) && (
              <p className="mt-1 text-sm text-slate-600">
                {[person.company, person.role].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isOwner && (
              <>
                <Link
                  href={`/people/${person.id}/edit`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Pencil className="h-4 w-4" />
                  עריכה
                </Link>
                <DeletePersonButton id={person.id} name={person.name} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 border-b border-slate-200">
        <nav className="flex flex-wrap gap-1">
          <TabLink
            href={`/people/${person.id}?tab=info`}
            active={tab === "info"}
            icon={<Info className="h-4 w-4" />}
            label="פרטים"
          />
          <TabLink
            href={`/people/${person.id}?tab=tasks`}
            active={tab === "tasks"}
            icon={<ListChecks className="h-4 w-4" />}
            label="משימות"
            count={tasks.length}
          />
          <TabLink
            href={`/people/${person.id}?tab=docs`}
            active={tab === "docs"}
            icon={<FolderOpen className="h-4 w-4" />}
            label="מסמכים"
            count={docs.length}
          />
          <TabLink
            href={`/people/${person.id}?tab=chat`}
            active={tab === "chat"}
            icon={<MessageSquare className="h-4 w-4" />}
            label="צ׳אט"
          />
        </nav>
      </div>

      <div className="mt-6">
        {tab === "info" && (
          <InfoTab
            person={person}
            owner={owner}
            tasks={tasks}
            docs={docs}
          />
        )}
        {tab === "tasks" && <TasksTab tasks={tasks} />}
        {tab === "docs" && <DocsTab docs={docs} />}
        {tab === "chat" && <ComingSoon />}
      </div>
    </div>
  );
}

type TaskRow = {
  id: string;
  title: string;
  status: "todo" | "doing" | "done";
  priority: "low" | "med" | "high";
  due_date: string | null;
  updated_at: string;
};

type DocRow = {
  id: string;
  name: string;
  mime_type: string | null;
  size: number | null;
  storage_path: string;
  uploaded_at: string;
};

function TabLink({
  href,
  active,
  icon,
  label,
  count,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition",
        active
          ? "border-brand-500 text-brand-700"
          : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900",
      )}
    >
      {icon}
      <span>{label}</span>
      {typeof count === "number" && count > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-medium",
            active ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-600",
          )}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

function InfoTab({
  person,
  owner,
  tasks,
  docs,
}: {
  person: Person;
  owner: OwnerProfile | null;
  tasks: TaskRow[];
  docs: DocRow[];
}) {
  const created = new Date(person.created_at).toLocaleDateString("he-IL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-display text-base font-bold text-slate-900">
          פרטים אישיים
        </h2>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <DetailItem icon={<Mail className="h-4 w-4" />} label="אימייל">
            {person.email ? (
              <a
                href={`mailto:${person.email}`}
                dir="ltr"
                className="text-brand-700 hover:underline"
              >
                {person.email}
              </a>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </DetailItem>
          <DetailItem icon={<Phone className="h-4 w-4" />} label="טלפון">
            {person.phone ? (
              <a
                href={`tel:${person.phone}`}
                dir="ltr"
                className="text-brand-700 hover:underline"
              >
                {person.phone}
              </a>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </DetailItem>
          <DetailItem icon={<Building2 className="h-4 w-4" />} label="חברה">
            {person.company ?? <span className="text-slate-400">—</span>}
          </DetailItem>
          <DetailItem icon={<Briefcase className="h-4 w-4" />} label="תפקיד">
            {person.role ?? <span className="text-slate-400">—</span>}
          </DetailItem>
          <DetailItem icon={<UserIcon className="h-4 w-4" />} label="בעלים">
            <span className="text-slate-900">{ownerDisplayName(owner)}</span>
          </DetailItem>
          <DetailItem icon={<CalendarDays className="h-4 w-4" />} label="נוצר">
            <span className="text-slate-900">{created}</span>
          </DetailItem>
        </dl>

        <div className="mt-6 border-t border-slate-100 pt-4">
          <dt className="text-xs font-medium text-slate-500">תיוגים</dt>
          <dd className="mt-2">
            <PeopleTags tags={person.tags} />
          </dd>
        </div>

        {person.notes && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <dt className="text-xs font-medium text-slate-500">הערות</dt>
            <dd className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
              {person.notes}
            </dd>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-slate-900">
            משימות מקושרות
          </h2>
          <span className="text-xs text-slate-500">{tasks.length}</span>
        </div>
        <TasksList tasks={tasks} compact />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-slate-900">
            מסמכים מקושרים
          </h2>
          <span className="text-xs text-slate-500">{docs.length}</span>
        </div>
        <DocsList docs={docs} compact />
      </section>
    </div>
  );
}

function DetailItem({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <span className="text-slate-400">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

function TasksTab({ tasks }: { tasks: TaskRow[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 font-display text-base font-bold text-slate-900">
        משימות מקושרות
      </h2>
      <TasksList tasks={tasks} />
    </div>
  );
}

function TasksList({
  tasks,
  compact,
}: {
  tasks: TaskRow[];
  compact?: boolean;
}) {
  if (tasks.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        עדיין אין משימות מקושרות לאיש קשר זה.
      </p>
    );
  }
  const items = compact ? tasks.slice(0, 5) : tasks;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((t) => (
        <li
          key={t.id}
          className="flex items-center justify-between gap-3 py-2.5"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">
              {t.title}
            </p>
            {t.due_date && (
              <p className="mt-0.5 text-xs text-slate-500">
                יעד: {new Date(t.due_date).toLocaleDateString("he-IL")}
              </p>
            )}
          </div>
          <TaskStatusChip status={t.status} />
        </li>
      ))}
      {compact && tasks.length > items.length && (
        <li className="pt-2 text-xs text-slate-500">
          ועוד {tasks.length - items.length}…
        </li>
      )}
    </ul>
  );
}

function TaskStatusChip({ status }: { status: TaskRow["status"] }) {
  const map = {
    todo: { label: "ממתינה", cls: "bg-slate-100 text-slate-700" },
    doing: { label: "בביצוע", cls: "bg-amber-100 text-amber-800" },
    done: { label: "הושלמה", cls: "bg-emerald-100 text-emerald-800" },
  } as const;
  const m = map[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
        m.cls,
      )}
    >
      {m.label}
    </span>
  );
}

function DocsTab({ docs }: { docs: DocRow[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 font-display text-base font-bold text-slate-900">
        מסמכים מקושרים
      </h2>
      <DocsList docs={docs} />
    </div>
  );
}

function DocsList({ docs, compact }: { docs: DocRow[]; compact?: boolean }) {
  if (docs.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        עדיין אין מסמכים מקושרים לאיש קשר זה.
      </p>
    );
  }
  const items = compact ? docs.slice(0, 5) : docs;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((d) => (
        <li
          key={d.id}
          className="flex items-center justify-between gap-3 py-2.5"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">
              {d.name}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {[
                d.mime_type ?? "קובץ",
                d.size ? formatBytes(d.size) : null,
                new Date(d.uploaded_at).toLocaleDateString("he-IL"),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </li>
      ))}
      {compact && docs.length > items.length && (
        <li className="pt-2 text-xs text-slate-500">
          ועוד {docs.length - items.length}…
        </li>
      )}
    </ul>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ComingSoon() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="text-sm text-slate-500">
        תוכן זה יתמלא בקרוב — המידע נטען מהמודולים השונים.
      </p>
    </div>
  );
}

