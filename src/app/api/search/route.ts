// GET /api/search?q={query} — global search powering the Cmd+K palette.
// Returns up to 5 matches per group (people / tasks / documents / datasets).
// Each sub-query is independent and defensive — if one table is missing or
// blows up, we still return whatever else we managed to fetch.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PersonHit = { id: string; name: string; company: string | null };
type TaskHit = { id: string; title: string; status: string };
type DocumentHit = { id: string; name: string };
type DatasetHit = { id: string; name: string };

type SearchResponse = {
  people: PersonHit[];
  tasks: TaskHit[];
  documents: DocumentHit[];
  datasets: DatasetHit[];
};

// Escape characters that have special meaning inside Postgres `ilike` so a
// query like "100%" or "_test_" doesn't behave as a wildcard.
function escapeIlike(raw: string): string {
  return raw.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  const empty: SearchResponse = {
    people: [],
    tasks: [],
    documents: [],
    datasets: [],
  };

  if (q.length === 0) {
    return NextResponse.json(empty);
  }

  const pattern = `%${escapeIlike(q)}%`;

  const [peopleHits, taskHits, documentHits, datasetHits] = await Promise.all([
    (async (): Promise<PersonHit[]> => {
      try {
        const { data } = await supabase
          .from("people")
          .select("id, name, company")
          .ilike("name", pattern)
          .limit(5);
        return ((data ?? []) as PersonHit[]).map((p) => ({
          id: p.id,
          name: p.name,
          company: p.company,
        }));
      } catch {
        return [];
      }
    })(),
    (async (): Promise<TaskHit[]> => {
      try {
        const { data } = await supabase
          .from("tasks")
          .select("id, title, status")
          .ilike("title", pattern)
          .limit(5);
        return ((data ?? []) as TaskHit[]).map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
        }));
      } catch {
        return [];
      }
    })(),
    (async (): Promise<DocumentHit[]> => {
      try {
        const { data } = await supabase
          .from("documents")
          .select("id, name")
          .ilike("name", pattern)
          .limit(5);
        return ((data ?? []) as DocumentHit[]).map((d) => ({
          id: d.id,
          name: d.name,
        }));
      } catch {
        return [];
      }
    })(),
    (async (): Promise<DatasetHit[]> => {
      // `datasets` may or may not exist in this schema. Treat missing-table
      // (and any other failure) as an empty group rather than 500ing.
      try {
        const { data, error } = await supabase
          .from("datasets")
          .select("id, name")
          .ilike("name", pattern)
          .limit(5);
        if (error) return [];
        return ((data ?? []) as DatasetHit[]).map((d) => ({
          id: d.id,
          name: d.name,
        }));
      } catch {
        return [];
      }
    })(),
  ]);

  const body: SearchResponse = {
    people: peopleHits,
    tasks: taskHits,
    documents: documentHits,
    datasets: datasetHits,
  };

  return NextResponse.json(body);
}
