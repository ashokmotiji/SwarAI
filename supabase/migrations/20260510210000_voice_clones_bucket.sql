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
