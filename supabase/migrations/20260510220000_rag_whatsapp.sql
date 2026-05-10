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
