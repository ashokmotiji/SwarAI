-- Analytics & ROI Tracking

alter table public.calls add column if not exists duration_seconds int;
alter table public.calls add column if not exists conversion_rate numeric(5, 2); -- 0 to 100
alter table public.calls add column if not exists order_value numeric(12, 2);
alter table public.calls add column if not exists sentiment_label text;

-- View for daily analytics summary
create or replace view public.daily_call_analytics as
select
  org_id,
  date_trunc('day', started_at) as day,
  count(*) as total_calls,
  sum(duration_seconds) as total_duration,
  avg(duration_seconds) as avg_duration,
  avg(sentiment_score) as avg_sentiment,
  count(*) filter (where status = 'completed') as completed_calls,
  sum(order_value) as total_order_value,
  avg(order_value) filter (where order_value > 0) as avg_order_value
from public.calls
group by org_id, date_trunc('day', started_at);
