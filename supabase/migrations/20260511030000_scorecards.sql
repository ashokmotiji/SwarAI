-- Performance Scorecards & Coaching

create table if not exists public.performance_scorecards (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete set null,
  org_id uuid not null references public.organizations (id) on delete cascade,

  overall_score numeric(4, 2), -- 0 to 10
  objection_handling_score numeric(4, 2),
  tone_score numeric(4, 2),
  product_knowledge_score numeric(4, 2),

  strengths text[],
  areas_for_improvement text[],
  coaching_suggestions text,

  created_at timestamptz not null default now()
);

create index if not exists performance_scorecards_call_idx on public.performance_scorecards (call_id);
create index if not exists performance_scorecards_org_idx on public.performance_scorecards (org_id);

alter table public.performance_scorecards enable row level security;
create policy performance_scorecards_all on public.performance_scorecards for all using (public.is_org_member(org_id));
