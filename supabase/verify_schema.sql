-- SwarSales AI — run in Supabase SQL Editor after applying all files in supabase/migrations/ in filename order.
-- Expect one row per name below if migrations are complete.

SELECT tablename AS expected_table
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'organizations',
    'organization_members',
    'agents',
    'calls',
    'knowledge_sources',
    'document_chunks',
    'ingestion_jobs',
    'payu_transactions',
    'razorpay_webhook_events'
  )
ORDER BY tablename;

-- Optional: confirm pgvector
SELECT EXISTS (
  SELECT 1 FROM pg_extension WHERE extname = 'vector'
) AS pgvector_installed;
