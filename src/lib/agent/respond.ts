import { NextResponse } from "next/server";
import { resolveAgentCaller, type AgentCaller } from "@/lib/agent/auth";

export function unauthorized() {
  return NextResponse.json(
    { error: "unauthorized", message: "טוקן חסר או לא תקין" },
    { status: 401 },
  );
}

export function forbidden(message = "אין הרשאה לפעולה הזו") {
  return NextResponse.json({ error: "forbidden", message }, { status: 403 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

export function notFound(message = "לא נמצא") {
  return NextResponse.json({ error: "not_found", message }, { status: 404 });
}

/** Authenticates the request; callers still enforce their own scope (self/team/admin). */
export async function requireCaller(
  request: Request,
): Promise<{ caller: AgentCaller } | { error: NextResponse }> {
  const caller = await resolveAgentCaller(request);
  if (!caller) return { error: unauthorized() };
  return { caller };
}
