-- Competitive Battle Cards

create table if not exists public.sales_battle_cards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  competitor_name text not null,
  key_objections text[],
  rebuttals jsonb not null default '{}', -- objection -> rebuttal mapping
  win_strategies text[],
  created_at timestamptz not null default now(),
  unique (org_id, competitor_name)
);

alter table public.sales_battle_cards enable row level security;
create policy sales_battle_cards_all on public.sales_battle_cards for all using (public.is_org_member(org_id));

-- Seed a few battle cards
insert into public.sales_battle_cards (org_id, competitor_name, key_objections, rebuttals, win_strategies)
select
  id,
  'MegaBrand',
  array['Too expensive', 'Brand trust'],
  '{"Too expensive": "Our product has 2x the shelf life, reducing waste costs by 30%.", "Brand trust": "We are now the #2 fastest growing brand in the region with 98% quality satisfaction."}'::jsonb,
  array['Highlight shelf-life ROI', 'Mention local success stories']
from public.organizations
limit 1;
