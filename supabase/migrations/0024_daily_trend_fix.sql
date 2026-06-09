-- 0024_daily_trend_fix.sql
--
-- Defensive re-apply of client_connectivity_daily_filtered() because the
-- production version was returning empty rows after the Kannada-exclusion
-- + lead-source repoint changes. Key change: when NO filter is set we
-- short-circuit the lead-pool subquery entirely (no IN against the leads
-- tables), so a single subtle data-quality mismatch between
-- upgrad_call_logs.lead_id and upgrad_*_leads.ls_prospect_id can't zero out
-- the chart. The Kannada exclusion is also moved directly onto the calls
-- scan, which is cheaper than joining via the leads CTE.

CREATE OR REPLACE FUNCTION public.client_connectivity_daily_filtered(
  p_lead_source text[] DEFAULT NULL,
  p_data_acquisition_channel text[] DEFAULT NULL,
  p_data_source_type text[] DEFAULT NULL,
  p_data_source_name text[] DEFAULT NULL,
  p_data_source_batch text[] DEFAULT NULL,
  p_utm_source text[] DEFAULT NULL,
  p_original_utm_source text[] DEFAULT NULL,
  p_original_utm_campaign text[] DEFAULT NULL,
  p_original_utm_medium text[] DEFAULT NULL,
  p_original_utm_content text[] DEFAULT NULL,
  p_original_utm_term text[] DEFAULT NULL
) RETURNS TABLE(
  day date,
  attempted bigint,
  connected bigint,
  engaged bigint,
  connect_pct numeric,
  engage_pct numeric
)
LANGUAGE sql STABLE SECURITY DEFINER AS $function$
  WITH days AS (
    SELECT generate_series(
      (CURRENT_DATE - INTERVAL '29 days')::date,
      CURRENT_DATE::date,
      INTERVAL '1 day'
    )::date AS day
  ),
  -- Only build the lead pool if SOME filter is set. When everything is NULL,
  -- the lead-side filter contributes nothing, so we skip the subquery and
  -- count every non-Kannada call directly.
  has_filter AS (
    SELECT (
      p_lead_source              IS NOT NULL OR
      p_data_acquisition_channel IS NOT NULL OR
      p_data_source_type         IS NOT NULL OR
      p_data_source_name         IS NOT NULL OR
      p_data_source_batch        IS NOT NULL OR
      p_utm_source               IS NOT NULL OR
      p_original_utm_source      IS NOT NULL OR
      p_original_utm_campaign    IS NOT NULL OR
      p_original_utm_medium      IS NOT NULL OR
      p_original_utm_content     IS NOT NULL OR
      p_original_utm_term        IS NOT NULL
    ) AS active
  ),
  filtered_leads AS (
    SELECT ls_prospect_id FROM upgrad_active_leads
    WHERE NOT public.is_campaign_dashboard_excluded(campaign_id)
      AND (p_lead_source              IS NULL OR data_source_name        = ANY(p_lead_source))
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
      AND (p_lead_source              IS NULL OR data_source_name        = ANY(p_lead_source))
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
  lead_day AS (
    SELECT
      cl.lead_id,
      date_trunc('day', cl.call_start AT TIME ZONE 'Asia/Kolkata')::date AS day,
      bool_or(cl.enquiry_classification IS NOT NULL AND cl.enquiry_classification NOT IN ('DNP','INVALID')) AS was_connected,
      bool_or(cl.enquiry_classification IN ('HOT','WARM','CB_LATER')) AS was_engaged
    FROM upgrad_call_logs cl
    WHERE (cl.call_flagged = false OR cl.call_flagged IS NULL)
      AND cl.call_start IS NOT NULL
      AND cl.call_start >= (CURRENT_DATE - INTERVAL '30 days')
      AND NOT public.is_campaign_dashboard_excluded(cl.campaign_id)
      AND (
        NOT (SELECT active FROM has_filter)
        OR cl.lead_id IN (SELECT ls_prospect_id FROM filtered_leads)
      )
    GROUP BY cl.lead_id, day
  ),
  daily AS (
    SELECT
      day,
      count(*)                              AS attempted,
      count(*) FILTER (WHERE was_connected) AS connected,
      count(*) FILTER (WHERE was_engaged)   AS engaged
    FROM lead_day
    GROUP BY day
  )
  SELECT
    d.day                                       AS day,
    COALESCE(da.attempted, 0)::bigint           AS attempted,
    COALESCE(da.connected, 0)::bigint           AS connected,
    COALESCE(da.engaged,   0)::bigint           AS engaged,
    CASE WHEN COALESCE(da.attempted, 0) > 0
         THEN round(100.0 * COALESCE(da.connected, 0)::numeric / da.attempted::numeric, 1)
         ELSE NULL END                          AS connect_pct,
    CASE WHEN COALESCE(da.attempted, 0) > 0
         THEN round(100.0 * COALESCE(da.engaged, 0)::numeric / da.attempted::numeric, 1)
         ELSE NULL END                          AS engage_pct
  FROM days d
  LEFT JOIN daily da ON da.day = d.day
  ORDER BY d.day;
$function$;

GRANT EXECUTE ON FUNCTION public.client_connectivity_daily_filtered(text[],text[],text[],text[],text[],text[],text[],text[],text[],text[],text[])
  TO authenticated, anon, service_role;

-- Sanity probe (uncomment + run after applying):
-- SELECT day::text, attempted, connected, engaged, connect_pct
-- FROM public.client_connectivity_daily_filtered()
-- WHERE day >= CURRENT_DATE - 7
-- ORDER BY day DESC;
