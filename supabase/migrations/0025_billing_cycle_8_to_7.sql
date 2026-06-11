-- 0025_billing_cycle_8_to_7.sql
--
-- Voice-minute view, 8th-of-month → 8th billing cycle (UGSOT amendment
-- 2026-06-09). Plus two robustness changes after digging into the data:
--
-- 1. Also exclude the UGSOT_JUN_2026 allocation row (it's Kannada-specific,
--    not the main campaign — clarified by UGSOT 2026-06-11). Joins on the
--    existing dashboard_excluded_campaigns config.
--
-- 2. Decouple allocation lookup from the cycle's anchor month. Ingestion
--    hasn't been rolling the call_logs.campaign_id forward (Jun 8+ calls
--    still tagged UGSOT_MAY_2026), and the allocation table doesn't always
--    get a fresh per-month row. Pick the most-recent non-excluded allocation
--    row and sum non-excluded minutes in the cycle window. Single-tenant
--    semantics: one rolling budget for the whole UGSOT campaign.

INSERT INTO public.dashboard_excluded_campaigns (campaign_id, note)
VALUES ('UGSOT_JUN_2026', 'Kannada batch allocation — UGSOT request 2026-06-11')
ON CONFLICT (campaign_id) DO NOTHING;

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
    (cycle_start + INTERVAL '1 month')::date           AS cycle_end         -- exclusive
  FROM cycle
),
current_alloc AS (
  SELECT
    a.campaign_id,
    a.allocated_voice_minutes AS allocated_minutes,
    b.cycle_start,
    b.cycle_end
  FROM bounds b, dashboard_campaign_allocations a
  WHERE NOT public.is_campaign_dashboard_excluded(a.campaign_id)
  ORDER BY a.allocation_month DESC, a.allocated_voice_minutes DESC
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
