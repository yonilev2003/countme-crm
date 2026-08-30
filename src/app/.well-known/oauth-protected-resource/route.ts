// RFC 9728 protected resource metadata for the remote MCP endpoint — tells
// a client which authorization server to use when it gets a 401 from
// /api/mcp.

import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  return NextResponse.json({
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
  });
}
