-- Migration 18: Voice-minute view now tracks the UGSOT contractual billing
-- cycle (18th of one month → 17th of next, inclusive). Replaces the
-- calendar-month bucketing that left the card showing 0/22000 on the 1st of
-- each calendar month, when in reality we're partway through the previous
-- billing cycle. Verified today (Jun 1) → cycle = May 18–Jun 17, ~5095/22000.
--
-- Column rename: `allocation_month` → `billing_cycle_start` + `billing_cycle_end`.
-- The TS query helper + Overview MetricCard are updated in the same push.
--
-- Apply: paste this in the Supabase Studio SQL editor for project
-- lcfkznqziubuefwnvqlb (the MCP migration tool is currently permission-denied).

CREATE OR REPLACE VIEW v_client_minutes_summary AS
WITH cycle AS (
  SELECT
    CASE
      WHEN EXTRACT(day FROM CURRENT_DATE) >= 18
        THEN date_trunc('month', CURRENT_DATE)::date + INTERVAL '17 days'
      ELSE (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date + INTERVAL '17 days'
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
  SELECT a.campaign_id,
         a.allocated_voice_minutes AS allocated_minutes,
         b.cycle_start,
         b.cycle_end
  FROM bounds b
  LEFT JOIN dashboard_campaign_allocations a
    ON a.allocation_month = b.allocation_month_key
),
cycle_usage AS (
  SELECT
    cl.campaign_id,
    ROUND(SUM(COALESCE(cl.duration_seconds, 0))::numeric / 60.0, 1) AS minutes_used
  FROM upgrad_call_logs cl, bounds b
  WHERE cl.call_start >= b.cycle_start
    AND cl.call_start <  b.cycle_end
    AND (cl.call_flagged = false OR cl.call_flagged IS NULL)
  GROUP BY cl.campaign_id
)
SELECT
  a.campaign_id,
  a.cycle_start                          AS billing_cycle_start,
  a.cycle_end                            AS billing_cycle_end,
  a.allocated_minutes,
  COALESCE(u.minutes_used, 0::numeric)   AS minutes_used,
  GREATEST(a.allocated_minutes::numeric - COALESCE(u.minutes_used, 0::numeric), 0::numeric) AS minutes_remaining,
  CASE
    WHEN a.allocated_minutes IS NULL OR a.allocated_minutes = 0 THEN 0::numeric
    ELSE ROUND(100.0 * COALESCE(u.minutes_used, 0::numeric) / a.allocated_minutes::numeric, 1)
  END AS utilization_pct
FROM current_alloc a
LEFT JOIN cycle_usage u ON u.campaign_id = a.campaign_id;
