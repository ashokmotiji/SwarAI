-- SwarSales AI — ONE-SHOT: paste this entire file into Supabase Dashboard → SQL Editor → Run.
-- Equivalent to running all files in supabase/migrations/ in sorted order.
-- After success, run verify_schema.sql.

-- SwarSales AI — schema, pgvector, RLS (Clerk `sub` in JWT when using Supabase third-party auth)
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Clerk / Supabase: configure JWT with role claim; `sub` is Clerk user id
create or replace function public.requesting_user_id()
returns text as $$
  select coalesce(auth.jwt()->>'sub', '');
$$ language sql stable;

-- -----------------------------------------------------------------------------
-- Profiles (optional cache of Clerk users)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id text primary key,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Organizations & members
-- -----------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  data_region text not null default 'IN',
  retention_days int,
  stripe_customer_id text,
  razorpay_customer_id text,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id text not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index if not exists organization_members_user_idx on public.organization_members (user_id);

create or replace function public.is_org_member(p_org uuid)
returns boolean as $$
  select exists (
    select 1 from public.organization_members m
    where m.org_id = p_org and m.user_id = public.requesting_user_id()
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.user_org_ids()
returns setof uuid as $$
  select m.org_id from public.organization_members m
  where m.user_id = public.requesting_user_id();
$$ language sql stable security definer set search_path = public;

-- -----------------------------------------------------------------------------
-- API keys (hashed)
-- -----------------------------------------------------------------------------
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists api_keys_org_idx on public.api_keys (org_id);

-- -----------------------------------------------------------------------------
-- Agents
-- -----------------------------------------------------------------------------
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  system_prompt text not null,
  default_language text not null default 'en',
  supported_languages text[] not null default array['en', 'hi', 'auto'],
  voice_id text not null default 'anushka',
  provider_stack text not null default 'sarvam',
  hinglish_friendly boolean not null default true,
  telephony_config jsonb not null default '{}',
  embed_allowed_origins text[] default '{}',
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger agents_updated_at
  before update on public.agents
  for each row execute function public.set_updated_at();

create index if not exists agents_org_idx on public.agents (org_id);

-- -----------------------------------------------------------------------------
-- Agent builder: flows & tools
-- -----------------------------------------------------------------------------
create table if not exists public.agent_flows (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  version int not null default 1,
  graph jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (agent_id, version)
);

create table if not exists public.agent_tools (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  tool_name text not null,
  config jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists agent_tools_agent_idx on public.agent_tools (agent_id);

-- -----------------------------------------------------------------------------
-- Calls & artifacts
-- -----------------------------------------------------------------------------
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete set null,
  channel text not null check (channel in ('web', 'phone', 'whatsapp', 'embed')),
  status text not null default 'active' check (status in ('active', 'completed', 'failed', 'transferred')),
  livekit_room text,
  transcript jsonb,
  summary text,
  sentiment_score numeric(4, 3),
  quality_score numeric(4, 3),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  provider_meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists calls_org_started_idx on public.calls (org_id, started_at desc);

create table if not exists public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  ts_ms bigint,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists transcript_segments_call_idx on public.transcript_segments (call_id);

create table if not exists public.call_summaries (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  body text not null,
  model text,
  created_at timestamptz not null default now()
);

create table if not exists public.call_scores (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  rubric text not null,
  score numeric(5, 2) not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.sentiment_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  phase text not null check (phase in ('live', 'post')),
  label text not null,
  score numeric(5, 3),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Knowledge base
-- -----------------------------------------------------------------------------
create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete cascade,
  kind text not null check (kind in ('pdf', 'url', 'text')),
  title text,
  source_uri text,
  storage_path text,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists knowledge_sources_agent_idx on public.knowledge_sources (agent_id);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.knowledge_sources (id) on delete cascade,
  content text not null,
  embedding vector(1536),
  chunk_index int not null default 0,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists document_chunks_source_idx on public.document_chunks (source_id);

create table if not exists public.ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.knowledge_sources (id) on delete cascade,
  state text not null default 'queued' check (state in ('queued', 'running', 'done', 'error')),
  error text,
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Prompt optimization
-- -----------------------------------------------------------------------------
create table if not exists public.prompt_suggestions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  call_sample_size int not null,
  suggestion text not null,
  diff jsonb,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.applied_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  prompt text not null,
  version int not null,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Marketplace templates
-- -----------------------------------------------------------------------------
create table if not exists public.marketplace_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  category text not null,
  template_agent jsonb not null,
  is_pro boolean not null default false,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Audit
-- -----------------------------------------------------------------------------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations (id) on delete set null,
  actor_id text,
  action text not null,
  resource text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.api_keys enable row level security;
alter table public.agents enable row level security;
alter table public.agent_flows enable row level security;
alter table public.agent_tools enable row level security;
alter table public.calls enable row level security;
alter table public.transcript_segments enable row level security;
alter table public.call_summaries enable row level security;
alter table public.call_scores enable row level security;
alter table public.sentiment_events enable row level security;
alter table public.knowledge_sources enable row level security;
alter table public.document_chunks enable row level security;
alter table public.ingestion_jobs enable row level security;
alter table public.prompt_suggestions enable row level security;
alter table public.applied_prompt_versions enable row level security;
alter table public.marketplace_templates enable row level security;
alter table public.audit_log enable row level security;

-- Profiles: user can read/update self
create policy profiles_select_self on public.profiles for select using (id = public.requesting_user_id());
create policy profiles_upsert_self on public.profiles for insert with check (id = public.requesting_user_id());
create policy profiles_update_self on public.profiles for update using (id = public.requesting_user_id());

-- Org: members can read their orgs
create policy orgs_select_member on public.organizations for select using (public.is_org_member(id));
create policy orgs_update_admin on public.organizations for update using (
  exists (
    select 1 from public.organization_members m
    where m.org_id = organizations.id
      and m.user_id = public.requesting_user_id()
      and m.role in ('owner', 'admin')
  )
);

create policy org_members_select on public.organization_members for select using (public.is_org_member(org_id));
-- Inserts/updates to organization_members: use Supabase service role from trusted server (Clerk-verified API)
create policy org_members_delete_admin on public.organization_members for delete using (
  exists (
    select 1 from public.organization_members m
    where m.org_id = organization_members.org_id
      and m.user_id = public.requesting_user_id()
      and m.role in ('owner', 'admin')
  )
);

create policy api_keys_select on public.api_keys for select using (public.is_org_member(org_id));
create policy api_keys_mutate on public.api_keys for all using (
  exists (
    select 1 from public.organization_members m
    where m.org_id = api_keys.org_id
      and m.user_id = public.requesting_user_id()
      and m.role in ('owner', 'admin')
  )
);

create policy agents_all on public.agents for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy agent_flows_all on public.agent_flows for all using (
  exists (select 1 from public.agents a where a.id = agent_flows.agent_id and public.is_org_member(a.org_id))
) with check (
  exists (select 1 from public.agents a where a.id = agent_flows.agent_id and public.is_org_member(a.org_id))
);
create policy agent_tools_all on public.agent_tools for all using (
  exists (select 1 from public.agents a where a.id = agent_tools.agent_id and public.is_org_member(a.org_id))
) with check (
  exists (select 1 from public.agents a where a.id = agent_tools.agent_id and public.is_org_member(a.org_id))
);

create policy calls_all on public.calls for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy transcript_segments_all on public.transcript_segments for all using (
  exists (select 1 from public.calls c where c.id = transcript_segments.call_id and public.is_org_member(c.org_id))
);
create policy call_summaries_all on public.call_summaries for all using (
  exists (select 1 from public.calls c where c.id = call_summaries.call_id and public.is_org_member(c.org_id))
);
create policy call_scores_all on public.call_scores for all using (
  exists (select 1 from public.calls c where c.id = call_scores.call_id and public.is_org_member(c.org_id))
);
create policy sentiment_events_all on public.sentiment_events for all using (
  exists (select 1 from public.calls c where c.id = sentiment_events.call_id and public.is_org_member(c.org_id))
);

create policy knowledge_sources_all on public.knowledge_sources for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy document_chunks_all on public.document_chunks for all using (
  exists (select 1 from public.knowledge_sources k where k.id = document_chunks.source_id and public.is_org_member(k.org_id))
);
create policy ingestion_jobs_all on public.ingestion_jobs for all using (
  exists (select 1 from public.knowledge_sources k where k.id = ingestion_jobs.source_id and public.is_org_member(k.org_id))
);

create policy prompt_suggestions_all on public.prompt_suggestions for all using (
  exists (select 1 from public.agents a where a.id = prompt_suggestions.agent_id and public.is_org_member(a.org_id))
);
create policy applied_prompt_versions_all on public.applied_prompt_versions for all using (
  exists (select 1 from public.agents a where a.id = applied_prompt_versions.agent_id and public.is_org_member(a.org_id))
);

-- Marketplace: public read
create policy marketplace_read on public.marketplace_templates for select using (true);

create policy audit_select on public.audit_log for select using (public.is_org_member(org_id));

-- Storage buckets (Supabase only — skip if `storage` schema is missing)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    insert into storage.buckets (id, name, public)
    values ('knowledge-pdfs', 'knowledge-pdfs', false)
    on conflict (id) do nothing;
    insert into storage.buckets (id, name, public)
    values ('call-recordings', 'call-recordings', false)
    on conflict (id) do nothing;
  end if;
end $$;

-- Seed marketplace templates
insert into public.marketplace_templates (slug, title, description, category, template_agent, is_pro)
values
  ('support-hi-en', 'Hindi–English support', 'Polite CS agent with Hinglish.', 'support',
   '{"name":"Support Star","systemPrompt":"You are a customer support agent for an Indian brand. Greet respectfully; use ji where natural. Resolve billing and order issues.","defaultLanguage":"hi","supportedLanguages":["hi","en","auto"],"voiceId":"anushka","providerStack":"sarvam"}'::jsonb, false),
  ('sales-appointments', 'Sales + appointments', 'Books meetings; uses calendar tone.', 'sales',
   '{"name":"Sales Closer","systemPrompt":"You qualify leads and book appointments. Mention IST times.","defaultLanguage":"en","supportedLanguages":["en","hi"],"voiceId":"abhilash","providerStack":"sarvam"}'::jsonb, false),
  ('health-triage', 'Healthcare triage (info only)', 'Non-diagnostic triage script.', 'healthcare',
   '{"name":"Care Navigator","systemPrompt":"You provide general information only; advise seeing a clinician for medical decisions.","defaultLanguage":"en","supportedLanguages":["en","hi","ta"],"voiceId":"vidya","providerStack":"sarvam"}'::jsonb, true)
on conflict (slug) do nothing;

-- ========== 20260510210000_voice_clones_bucket.sql ==========
-- Voice clone samples (30s audio) — wire to Sarvam custom voice when available
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    insert into storage.buckets (id, name, public)
    values ('voice-clones', 'voice-clones', false)
    on conflict (id) do nothing;
  end if;
end $$;

-- ========== 20260510220000_rag_whatsapp.sql ==========
-- RAG: vector similarity search scoped to agent + org knowledge sources
create or replace function public.match_document_chunks_for_agent(
  p_agent_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 8
)
returns table (content text, similarity double precision)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select a.org_id into v_org from public.agents a where a.id = p_agent_id;
  if v_org is null then
    return;
  end if;

  return query
  select
    dc.content,
    (1.0::double precision - (dc.embedding <=> p_query_embedding)::double precision) as similarity
  from public.document_chunks dc
  inner join public.knowledge_sources ks on ks.id = dc.source_id
  where ks.org_id = v_org
    and dc.embedding is not null
    and (ks.agent_id is null or ks.agent_id = p_agent_id)
  order by dc.embedding <=> p_query_embedding
  limit greatest(1, least(p_match_count, 32));
end;
$$;

revoke all on function public.match_document_chunks_for_agent(uuid, vector, int) from public;
grant execute on function public.match_document_chunks_for_agent(uuid, vector, int) to service_role;

-- WhatsApp inbound log (service role writes; optional operator review)
create table if not exists public.whatsapp_inbound (
  id uuid primary key default gen_random_uuid(),
  raw jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.whatsapp_inbound enable row level security;
-- RLS on: anon/authenticated have no policies (deny). Service role bypasses for server-side inserts.

-- ========== 20260510240000_razorpay_webhook_events.sql ==========
-- Razorpay webhook audit + idempotency (written by service role from /api/webhooks/razorpay)
create table if not exists public.razorpay_webhook_events (
  id uuid primary key default gen_random_uuid(),
  razorpay_event_id text not null unique,
  org_id uuid references public.organizations (id) on delete set null,
  event_type text not null,
  summary jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists razorpay_webhook_events_org_idx on public.razorpay_webhook_events (org_id, created_at desc);

alter table public.razorpay_webhook_events enable row level security;

create policy razorpay_webhook_events_org_select on public.razorpay_webhook_events
  for select using (org_id is not null and public.is_org_member(org_id));

-- ========== 20260510250000_payu_transactions.sql ==========
-- PayU hosted checkout: server-side txn registry for callback verification
create table if not exists public.payu_transactions (
  id uuid primary key default gen_random_uuid(),
  txnid text not null unique,
  org_id uuid not null references public.organizations (id) on delete cascade,
  amount text not null,
  intent text not null default 'demo' check (intent in ('demo', 'pro')),
  fulfilled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payu_transactions_org_idx on public.payu_transactions (org_id, created_at desc);

alter table public.payu_transactions enable row level security;

create policy payu_transactions_org_select on public.payu_transactions
  for select using (public.is_org_member(org_id));
