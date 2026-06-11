-- 0025_billing_cycle_8_to_7.sql
--
-- Voice-minute view, switched to the 8th-of-month → 8th billing cycle (UGSOT
-- amendment 2026-06-09). Same column shape as 0018; only the day-of-month
-- boundary moves AND the usage subquery is now decoupled from the allocation's
-- campaign_id.
--
-- Why decoupled: ingestion has been lagging on rolling campaign_id forward
-- (e.g. Jun 8+ calls were still tagged UGSOT_MAY_2026 while the allocation
-- row was keyed UGSOT_JUN_2026), zeroing out minutes_used. We aggregate
-- minutes for the whole cycle window across all non-Kannada campaigns, and
-- pull the allocation for the cycle's anchor month independently.

CREATE OR REPLACE VIEW public.v_client_minutes_summary AS
WITH cycle AS (
  SELECT
    CASE
      WHEN EXTRACT(day FROM CURRENT_DATE) >= 8
        THEN date_trunc('month', CURRENT_DATE)::date + INTERVAL '7 days'
      ELSE (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date + INTERVAL '7 days'
    END AS cycle_start
),
bounds AS (
  SELECT
    cycle_start::date                                  AS cycle_start,
    (cycle_start + INTERVAL '1 month')::date           AS cycle_end,         -- exclusive
    date_trunc('month', cycle_start)::date             AS allocation_month_key
  FROM cycle
),
current_alloc AS (
  SELECT
    a.campaign_id,
    a.allocated_voice_minutes AS allocated_minutes,
    b.cycle_start,
    b.cycle_end
  FROM bounds b
  LEFT JOIN dashboard_campaign_allocations a
    ON a.allocation_month = b.allocation_month_key
  ORDER BY a.allocated_voice_minutes DESC NULLS LAST
  LIMIT 1
),
cycle_usage AS (
  SELECT
    ROUND(SUM(COALESCE(cl.duration_seconds, 0))::numeric / 60.0, 1) AS minutes_used
  FROM upgrad_call_logs cl, bounds b
  WHERE cl.call_start >= b.cycle_start
    AND cl.call_start <  b.cycle_end
    AND (cl.call_flagged = false OR cl.call_flagged IS NULL)
    AND NOT public.is_campaign_dashboard_excluded(cl.campaign_id)
)
SELECT
  a.campaign_id,
  a.cycle_start                                     AS billing_cycle_start,
  a.cycle_end                                       AS billing_cycle_end,
  a.allocated_minutes,
  COALESCE(u.minutes_used, 0::numeric)              AS minutes_used,
  GREATEST(a.allocated_minutes::numeric - COALESCE(u.minutes_used, 0::numeric), 0::numeric) AS minutes_remaining,
  CASE
    WHEN a.allocated_minutes IS NULL OR a.allocated_minutes = 0 THEN 0::numeric
    ELSE ROUND(100.0 * COALESCE(u.minutes_used, 0::numeric) / a.allocated_minutes::numeric, 1)
  END AS utilization_pct
FROM current_alloc a, cycle_usage u;
