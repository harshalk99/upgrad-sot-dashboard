-- 0028_single_cycle_minutes_card.sql
--
-- Overview now shows ONE voice-minutes card (the 8th-to-8th billing cycle)
-- with a per-campaign breakup, instead of two cards (cycle + calendar month).
--
-- Both the cycle total and the breakup now EXCLUDE coming_soon campaigns
-- (e.g. Kannada). When Kannada was flipped to coming_soon in 0026/d18c329 it
-- was removed from dashboard_excluded_campaigns so super_admin could see its
-- other data — but that let its (zero-minute) usage leak into the client
-- minutes aggregate. Excluding visibility='coming_soon' keeps it out of any
-- usage/billing surface until it's promoted to 'all'.

-- Cycle total — exclude coming_soon campaigns.
CREATE OR REPLACE FUNCTION public.client_minutes_summary(p_campaign_id text DEFAULT NULL)
RETURNS TABLE(
  campaign_id text, billing_cycle_start date, billing_cycle_end date,
  allocated_minutes integer, minutes_used numeric, minutes_remaining numeric,
  utilization_pct numeric
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH cycle AS (
    SELECT CASE WHEN EXTRACT(day FROM CURRENT_DATE) >= 8
      THEN date_trunc('month', CURRENT_DATE)::date + INTERVAL '7 days'
      ELSE (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date + INTERVAL '7 days'
    END AS cycle_start
  ),
  bounds AS (
    SELECT cycle_start::date AS cycle_start, (cycle_start + INTERVAL '1 month')::date AS cycle_end FROM cycle
  ),
  coming_soon AS (
    SELECT campaign_id FROM dashboard_campaigns WHERE visibility = 'coming_soon'
  ),
  current_alloc AS (
    SELECT a.campaign_id, a.allocated_voice_minutes AS allocated_minutes, b.cycle_start, b.cycle_end
    FROM bounds b, dashboard_campaign_allocations a
    WHERE NOT public.is_campaign_dashboard_excluded(a.campaign_id)
      AND a.campaign_id NOT IN (SELECT campaign_id FROM coming_soon)
      AND (p_campaign_id IS NULL OR a.campaign_id = p_campaign_id)
    ORDER BY a.allocation_month DESC, a.allocated_voice_minutes DESC
    LIMIT 1
  ),
  cycle_usage AS (
    SELECT ROUND(SUM(COALESCE(cl.duration_seconds, 0))::numeric / 60.0, 1) AS minutes_used
    FROM upgrad_call_logs cl CROSS JOIN bounds b
    WHERE cl.call_start >= b.cycle_start AND cl.call_start < b.cycle_end
      AND (cl.call_flagged = false OR cl.call_flagged IS NULL)
      AND NOT public.is_campaign_dashboard_excluded(cl.campaign_id)
      AND cl.campaign_id NOT IN (SELECT campaign_id FROM coming_soon)
      AND (p_campaign_id IS NULL OR cl.campaign_id = p_campaign_id)
  )
  SELECT a.campaign_id, a.cycle_start, a.cycle_end, a.allocated_minutes,
         COALESCE(u.minutes_used, 0::numeric),
         GREATEST(a.allocated_minutes::numeric - COALESCE(u.minutes_used, 0::numeric), 0::numeric),
         CASE WHEN a.allocated_minutes IS NULL OR a.allocated_minutes = 0 THEN 0::numeric
              ELSE ROUND(100.0 * COALESCE(u.minutes_used, 0::numeric) / a.allocated_minutes::numeric, 1) END
  FROM current_alloc a CROSS JOIN cycle_usage u;
$$;
GRANT EXECUTE ON FUNCTION public.client_minutes_summary(text) TO authenticated, anon, service_role;

-- Per-campaign breakup over the SAME cycle window (replaces the calendar-month
-- breakup), excluding coming_soon + excluded campaigns.
CREATE OR REPLACE FUNCTION public.client_minutes_by_campaign_cycle(p_campaign_id text[] DEFAULT NULL)
RETURNS TABLE(campaign_id text, display_name text, minutes_used numeric)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH cycle AS (
    SELECT CASE WHEN EXTRACT(day FROM CURRENT_DATE) >= 8
      THEN date_trunc('month', CURRENT_DATE)::date + INTERVAL '7 days'
      ELSE (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date + INTERVAL '7 days'
    END AS cycle_start
  ),
  bounds AS (
    SELECT cycle_start::date AS cycle_start, (cycle_start + INTERVAL '1 month')::date AS cycle_end FROM cycle
  )
  SELECT cl.campaign_id,
         COALESCE(dc.display_name, cl.campaign_id),
         ROUND(SUM(COALESCE(cl.duration_seconds, 0))::numeric / 60.0, 1)
  FROM upgrad_call_logs cl
  CROSS JOIN bounds b
  LEFT JOIN dashboard_campaigns dc ON dc.campaign_id = cl.campaign_id
  WHERE cl.call_start >= b.cycle_start AND cl.call_start < b.cycle_end
    AND (cl.call_flagged = false OR cl.call_flagged IS NULL)
    AND NOT public.is_campaign_dashboard_excluded(cl.campaign_id)
    AND COALESCE(dc.visibility, 'all') <> 'coming_soon'
    AND (p_campaign_id IS NULL OR cl.campaign_id = ANY(p_campaign_id))
  GROUP BY cl.campaign_id, dc.display_name
  ORDER BY 3 DESC;
$$;
GRANT EXECUTE ON FUNCTION public.client_minutes_by_campaign_cycle(text[]) TO authenticated, anon, service_role;
