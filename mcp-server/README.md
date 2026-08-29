# countme-mcp-server

MCP server that lets Claude (or any MCP client) read and update CountMe
CRM data through the validated `/api/agent/*` operations — no direct
database access, no SQL. See `../docs/agent-api.md` for the underlying
HTTP contract.

## Setup

1. Get a personal token: in CountMe, go to **Settings → מפתח AI** and
   create one. Copy it — it's shown once.
2. Build the server:
   ```bash
   cd mcp-server
   npm install
   npm run build
   ```
3. Add it to Claude Code (project- or user-scoped):
   ```bash
   claude mcp add countme \
     --env COUNTME_API_TOKEN=cme_xxxxxxxx \
     -- node /absolute/path/to/countme-crm/mcp-server/dist/index.js
   ```
   Or add the equivalent block to Claude Desktop's `claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "countme": {
         "command": "node",
         "args": ["/absolute/path/to/countme-crm/mcp-server/dist/index.js"],
         "env": { "COUNTME_API_TOKEN": "cme_xxxxxxxx" }
       }
     }
   }
   ```

By default the server talks to `https://countme-crm.vercel.app`. Set
`COUNTME_API_URL` to point elsewhere (e.g. a local dev server).

## Tools

`countme_get_my_tasks`, `countme_get_overdue_tasks`,
`countme_get_unassigned_tasks`, `countme_get_blocked_work`,
`countme_create_task`, `countme_update_task`, `countme_assign_task`,
`countme_complete_task`, `countme_get_team_overview`,
`countme_get_project_status`, `countme_get_user_activity`,
`countme_get_system_health`.

Each tool's exact behavior and permission tier are documented in its
`description` (visible to the model) and in `../docs/agent-api.md`.

## Scope note

This is a small, internal-scope MCP server for a 3-person team — it
wraps an already-built, already-authorized REST API rather than being a
general-purpose integration. It does not (yet) ship formal evaluations;
if this ever needs to support more users or a public rollout, add
proper eval coverage first.
