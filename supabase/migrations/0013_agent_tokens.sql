-- countme-crm: personal API tokens for the agent operations layer (idempotent)
-- Lets each team member mint a personal bearer token so an LLM tool
-- connector (Claude, ChatGPT, ...) can call the narrow, validated
-- /api/agent/* operations on their behalf — instead of that LLM holding a
-- raw Postgres/service-role connection.
--
-- Only a SHA-256 hash of the token is stored; the raw value is shown once
-- at creation time and never persisted. Row-level security lets a user
-- manage only their own tokens through the normal authenticated session;
-- validating a bearer token for the agent API itself is always done with
-- the service-role client (server-side only), which bypasses RLS by design.

set search_path = public;

create table if not exists agent_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null default 'ברירת מחדל',
  token_hash text not null unique,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_tokens_user on agent_tokens(user_id);

alter table agent_tokens enable row level security;

drop policy if exists agent_tokens_select_own on agent_tokens;
create policy agent_tokens_select_own on agent_tokens
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists agent_tokens_insert_own on agent_tokens;
create policy agent_tokens_insert_own on agent_tokens
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists agent_tokens_update_own on agent_tokens;
create policy agent_tokens_update_own on agent_tokens
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
