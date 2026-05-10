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
