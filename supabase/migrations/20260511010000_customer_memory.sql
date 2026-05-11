-- Advanced Conversation Memory and CRM Context

-- Track customer state/context across calls
create table if not exists public.customer_contexts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  customer_phone text not null,
  external_crm_id text, -- HubSpot/Salesforce ID
  context_data jsonb not null default '{}', -- Stores preferences, recent orders, active deals
  last_interaction_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (org_id, customer_phone)
);

create index if not exists customer_contexts_phone_idx on public.customer_contexts (customer_phone);
create index if not exists customer_contexts_org_idx on public.customer_contexts (org_id);

alter table public.customer_contexts enable row level security;
create policy customer_contexts_all on public.customer_contexts for all using (public.is_org_member(org_id));

-- Add customer_phone to calls if not already there (it might be in provider_meta)
alter table public.calls add column if not exists customer_phone text;

-- Function to get CRM context for an agent
create or replace function public.get_customer_context_for_call(
  p_org_id uuid,
  p_customer_phone text
)
returns jsonb
language plpgsql
stable
security definer
as $$
declare
  v_context jsonb;
begin
  select context_data into v_context
  from public.customer_contexts
  where org_id = p_org_id and customer_phone = p_customer_phone;

  return coalesce(v_context, '{}'::jsonb);
end;
$$;
