-- 0030_daily_engaged_by_lead_stage.sql
--
-- Final form of the Daily Connectivity Trend RPC. Builds on 0029 (connected =
-- pickup) by making "engaged" lead_stage-based instead of classification-based,
-- so it survives AI-classification lag the same way "connected" does.
--
--   connected (day X) = lead picked up >=1 call that day (duration_seconds > 0)
--   engaged   (day X) = connected that day AND the lead's current lead_stage is
--                       a buying-signal stage:
--                         AI Bot Qualified - High Intent
--                         AI Bot Qualified - Warm
--                         AI Bot Reached - CB Later
--                         AI Bot Sent - Brochure
--                         AI Bot Sent - Payment Link
--
-- The "connected that day" clamp guarantees engaged <= connected <= attempted
-- on every day even though lead_stage is the lead's current (not as-of-day)
-- value. Stage source means engaged is stable + consistent with the funnel and
-- disposition cards. Applied live via MCP 2026-06-18.

CREATE OR REPLACE FUNCTION public.client_connectivity_daily_filtered(
  p_campaign_id text[] DEFAULT NULL,
  p_lead_source text[] DEFAULT NULL, p_data_acquisition_channel text[] DEFAULT NULL,
  p_data_source_type text[] DEFAULT NULL, p_data_source_name text[] DEFAULT NULL,
  p_data_source_batch text[] DEFAULT NULL, p_utm_source text[] DEFAULT NULL,
  p_original_utm_source text[] DEFAULT NULL, p_original_utm_campaign text[] DEFAULT NULL,
  p_original_utm_medium text[] DEFAULT NULL, p_original_utm_content text[] DEFAULT NULL,
  p_original_utm_term text[] DEFAULT NULL
) RETURNS TABLE(day date, attempted bigint, connected bigint, engaged bigint, connect_pct numeric, engage_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH days AS (
    SELECT generate_series((CURRENT_DATE - INTERVAL '29 days')::date, CURRENT_DATE::date, INTERVAL '1 day')::date AS day
  ),
  has_filter AS (
    SELECT (p_lead_source IS NOT NULL OR p_data_acquisition_channel IS NOT NULL OR
            p_data_source_type IS NOT NULL OR p_data_source_name IS NOT NULL OR
            p_data_source_batch IS NOT NULL OR p_utm_source IS NOT NULL OR
            p_original_utm_source IS NOT NULL OR p_original_utm_campaign IS NOT NULL OR
            p_original_utm_medium IS NOT NULL OR p_original_utm_content IS NOT NULL OR
            p_original_utm_term IS NOT NULL) AS active
  ),
  filtered_leads AS (
    SELECT ls_prospect_id FROM upgrad_active_leads
    WHERE NOT public.is_campaign_dashboard_excluded(campaign_id)
      AND (p_campaign_id              IS NULL OR campaign_id              = ANY(p_campaign_id))
      AND (p_lead_source              IS NULL OR data_source_name         = ANY(p_lead_source))
      AND (p_data_acquisition_channel IS NULL OR data_acquisition_channel = ANY(p_data_acquisition_channel))
      AND (p_data_source_type         IS NULL OR data_source_type         = ANY(p_data_source_type))
      AND (p_data_source_name         IS NULL OR data_source_name         = ANY(p_data_source_name))
      AND (p_data_source_batch        IS NULL OR data_source_batch        = ANY(p_data_source_batch))
      AND (p_utm_source               IS NULL OR utm_source               = ANY(p_utm_source))
      AND (p_original_utm_source      IS NULL OR original_utm_source      = ANY(p_original_utm_source))
      AND (p_original_utm_campaign    IS NULL OR original_utm_campaign    = ANY(p_original_utm_campaign))
      AND (p_original_utm_medium      IS NULL OR original_utm_medium      = ANY(p_original_utm_medium))
      AND (p_original_utm_content     IS NULL OR original_utm_content     = ANY(p_original_utm_content))
      AND (p_original_utm_term        IS NULL OR original_utm_term        = ANY(p_original_utm_term))
    UNION ALL
    SELECT ls_prospect_id FROM upgrad_archived_leads
    WHERE NOT public.is_campaign_dashboard_excluded(campaign_id)
      AND (p_campaign_id              IS NULL OR campaign_id              = ANY(p_campaign_id))
      AND (p_lead_source              IS NULL OR data_source_name         = ANY(p_lead_source))
      AND (p_data_acquisition_channel IS NULL OR data_acquisition_channel = ANY(p_data_acquisition_channel))
      AND (p_data_source_type         IS NULL OR data_source_type         = ANY(p_data_source_type))
      AND (p_data_source_name         IS NULL OR data_source_name         = ANY(p_data_source_name))
      AND (p_data_source_batch        IS NULL OR data_source_batch        = ANY(p_data_source_batch))
      AND (p_utm_source               IS NULL OR utm_source               = ANY(p_utm_source))
      AND (p_original_utm_source      IS NULL OR original_utm_source      = ANY(p_original_utm_source))
      AND (p_original_utm_campaign    IS NULL OR original_utm_campaign    = ANY(p_original_utm_campaign))
      AND (p_original_utm_medium      IS NULL OR original_utm_medium      = ANY(p_original_utm_medium))
      AND (p_original_utm_content     IS NULL OR original_utm_content     = ANY(p_original_utm_content))
      AND (p_original_utm_term        IS NULL OR original_utm_term        = ANY(p_original_utm_term))
  ),
  lead_stages AS (
    SELECT ls_prospect_id, max(lead_stage) AS lead_stage FROM (
      SELECT ls_prospect_id, lead_stage FROM upgrad_active_leads
      UNION ALL SELECT ls_prospect_id, lead_stage FROM upgrad_archived_leads
    ) x GROUP BY ls_prospect_id
  ),
  lead_day AS (
    SELECT cl.lead_id, date_trunc('day', cl.call_start AT TIME ZONE 'Asia/Kolkata')::date AS day,
           bool_or(cl.duration_seconds > 0) AS was_connected
    FROM upgrad_call_logs cl
    WHERE (cl.call_flagged = false OR cl.call_flagged IS NULL)
      AND cl.call_start IS NOT NULL AND cl.call_start >= (CURRENT_DATE - INTERVAL '30 days')
      AND NOT public.is_campaign_dashboard_excluded(cl.campaign_id)
      AND (p_campaign_id IS NULL OR cl.campaign_id = ANY(p_campaign_id))
      AND (NOT (SELECT active FROM has_filter)
           OR cl.lead_id IN (SELECT ls_prospect_id FROM filtered_leads))
    GROUP BY cl.lead_id, day
  ),
  lead_day_tagged AS (
    SELECT ld.day,
           ld.was_connected,
           (ld.was_connected AND ls.lead_stage IN (
              'AI Bot Qualified - High Intent','AI Bot Qualified - Warm',
              'AI Bot Reached - CB Later','AI Bot Sent - Brochure','AI Bot Sent - Payment Link'
           )) AS was_engaged
    FROM lead_day ld
    LEFT JOIN lead_stages ls ON ls.ls_prospect_id = ld.lead_id
  ),
  daily AS (
    SELECT day, count(*) AS attempted,
           count(*) FILTER (WHERE was_connected) AS connected,
           count(*) FILTER (WHERE was_engaged)   AS engaged
    FROM lead_day_tagged GROUP BY day
  )
  SELECT d.day,
         COALESCE(da.attempted,0)::bigint, COALESCE(da.connected,0)::bigint, COALESCE(da.engaged,0)::bigint,
         CASE WHEN COALESCE(da.attempted,0) > 0
              THEN round(100.0 * COALESCE(da.connected,0)::numeric / da.attempted::numeric, 1) ELSE NULL END,
         CASE WHEN COALESCE(da.attempted,0) > 0
              THEN round(100.0 * COALESCE(da.engaged,0)::numeric / da.attempted::numeric, 1) ELSE NULL END
  FROM days d LEFT JOIN daily da ON da.day = d.day ORDER BY d.day;
$$;
GRANT EXECUTE ON FUNCTION public.client_connectivity_daily_filtered(text[],text[],text[],text[],text[],text[],text[],text[],text[],text[],text[],text[]) TO authenticated, anon, service_role;
