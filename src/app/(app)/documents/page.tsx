import { createClient } from "@/lib/supabase/server";
import { UploadZone } from "@/components/documents/upload-zone";
import { DocumentGrid } from "@/components/documents/document-grid";
import { DriveAutoSync } from "@/components/documents/drive-auto-sync";
import type {
  DocumentRow,
  OwnerInfo,
} from "@/components/documents/document-card";
import type {
  PersonOption,
  ProjectOption,
} from "@/components/documents/link-picker";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [documentsRes, profilesRes, peopleRes, projectsRes, teamCfgRes] =
    await Promise.all([
      supabase
        .from("documents")
        .select(
          "id, name, storage_path, mime_type, size, person_id, project_id, owner_id, uploaded_at, drive_file_id, drive_web_view_link, drive_sync_status",
        )
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, display_name, email, avatar_url"),
      supabase.from("people").select("id, name").order("name", { ascending: true }),
      supabase
        .from("projects")
        .select("id, name")
        .order("name", { ascending: true }),
      supabase
        .from("team_config")
        .select("shared_drive_refresh_token")
        .eq("id", 1)
        .maybeSingle(),
    ]);

  const documents: DocumentRow[] = (documentsRes.data ?? []) as DocumentRow[];
  const owners: OwnerInfo[] = (profilesRes.data ?? []) as OwnerInfo[];
  const people: PersonOption[] = (peopleRes.data ?? []) as PersonOption[];
  const projects: ProjectOption[] = (projectsRes.data ?? []) as ProjectOption[];
  const driveConnected = Boolean(
    teamCfgRes.data?.shared_drive_refresh_token,
  );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">מסמכים</h1>
        <p className="mt-2 text-slate-600">מסמכים משותפים של הצוות</p>
      </div>

      {driveConnected && <DriveAutoSync intervalMs={90_000} />}

      <UploadZone people={people} projects={projects} />

      <DocumentGrid
        documents={documents}
        owners={owners}
        people={people}
        projects={projects}
        currentUserId={user?.id ?? null}
        driveConnected={driveConnected}
      />
    </div>
  );
}
