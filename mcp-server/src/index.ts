#!/usr/bin/env node
// MCP server bridging Claude (or any MCP client) to the CountMe agent API.
// Every tool is a thin wrapper over one /api/agent/* endpoint — no SQL, no
// direct DB access. Auth is a personal bearer token (COUNTME_API_TOKEN),
// created by each team member under CountMe's Settings → מפתח AI.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerTeamTools } from "./tools/team.js";

async function main() {
  if (!process.env.COUNTME_API_TOKEN) {
    console.error(
      "ERROR: COUNTME_API_TOKEN is not set. Create a personal token in CountMe " +
        "(Settings → מפתח AI) and set it as an environment variable.",
    );
    process.exit(1);
  }

  const server = new McpServer({
    name: "countme-mcp-server",
    version: "1.0.0",
  });

  registerTaskTools(server);
  registerTeamTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("countme-mcp-server running via stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
