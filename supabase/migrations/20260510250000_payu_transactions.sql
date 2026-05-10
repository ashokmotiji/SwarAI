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
