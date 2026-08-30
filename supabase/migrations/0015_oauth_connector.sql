-- countme-crm: OAuth 2.1 authorization server for remote MCP connectors
-- (Claude.ai / ChatGPT "Add custom connector") (idempotent)
--
-- This does NOT introduce a new trust model: a completed OAuth flow just
-- mints a row in `agent_tokens` (the exact same personal-token mechanism
-- used by /settings/agent and /api/agent/*), so every permission check
-- already shipped and reviewed applies unchanged. What's new here is only
-- the handshake: dynamic client registration (RFC 7591), an authorization
-- code + PKCE exchange (OAuth 2.1 / RFC 7636), scoped to a caller who is
-- already signed into CountMe with their normal Google session.

set search_path = public;

create table if not exists oauth_clients (
  client_id text primary key,
  client_secret_hash text,
  client_name text not null default 'AI connector',
  redirect_uris text[] not null,
  created_at timestamptz not null default now()
);

create table if not exists oauth_auth_codes (
  code text primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  client_id text not null references oauth_clients(client_id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  code_challenge_method text not null default 'S256',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_oauth_auth_codes_user on oauth_auth_codes(user_id);

-- Both tables are only ever touched by the service-role client from
-- server-side OAuth route handlers (never the browser/anon key), so RLS
-- default-denies everything and no policies are needed.
alter table oauth_clients enable row level security;
alter table oauth_auth_codes enable row level security;
