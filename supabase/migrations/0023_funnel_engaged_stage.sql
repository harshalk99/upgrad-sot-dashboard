-- 0023_funnel_engaged_stage.sql
--
-- Restructures the Overview Lead Funnel into 4 stages:
--   Attempted   lead_stage <> 'Not Yet Called'
--   Connected   lead_stage NOT IN ('Not Yet Called', 'AI Bot Reached - DNP')
--   Engaged     lead_stage IN (Hot, Warm, CB Later, Not Interested, Not Eligible)
--   Qualified   lead_stage IN (Hot, Warm)   -- still surfaced as `qualified`
--
-- Adds an `engaged` column to v_client_funnel and client_funnel_filtered. The
-- old `qualified` column changes meaning: it now equals HOT+WARM only (was
-- HOT+WARM+CB_Later). CB_Later is still exposed as `callback_pending`.

DROP VIEW IF EXISTS public.v_client_funnel;

CREATE VIEW public.v_client_funnel AS
  WITH stages AS (
    SELECT COALESCE(lead_stage, 'Not Yet Called') AS stage FROM upgrad_active_leads
    WHERE NOT public.is_campaign_dashboard_excluded(campaign_id)
    UNION ALL
    SELECT COALESCE(lead_stage, 'Not Yet Called') FROM upgrad_archived_leads
    WHERE NOT public.is_campaign_dashboard_excluded(campaign_id)
  )
  SELECT count(*) AS total_leads,
         count(*) FILTER (WHERE stage <> 'Not Yet Called') AS attempted,
         count(*) FILTER (WHERE stage NOT IN ('Not Yet Called','AI Bot Reached - DNP')) AS connected,
         count(*) FILTER (WHERE stage IN (
           'AI Bot Qualified - High Intent','AI Bot Qualified - Warm',
           'AI Bot Reached - CB Later','AI Bot Called - Not Interested','AI Bot Called - Not Eligible'
         )) AS engaged,
         count(*) FILTER (WHERE stage IN ('AI Bot Qualified - High Intent','AI Bot Qualified - Warm')) AS qualified,
         count(*) FILTER (WHERE stage = 'AI Bot Qualified - High Intent') AS hot,
         count(*) FILTER (WHERE stage = 'AI Bot Qualified - Warm') AS warm,
         count(*) FILTER (WHERE stage = 'AI Bot Reached - CB Later') AS callback_pending
  FROM stages;

GRANT SELECT ON public.v_client_funnel TO authenticated, anon, service_role;

DROP FUNCTION IF EXISTS public.client_funnel_filtered(text[],text[],text[],text[],text[],text[],text[],text[],text[],text[],text[]);

CREATE FUNCTION public.client_funnel_filtered(
  p_lead_source text[] DEFAULT NULL, p_data_acquisition_channel text[] DEFAULT NULL,
  p_data_source_type text[] DEFAULT NULL, p_data_source_name text[] DEFAULT NULL,
  p_data_source_batch text[] DEFAULT NULL, p_utm_source text[] DEFAULT NULL,
  p_original_utm_source text[] DEFAULT NULL, p_original_utm_campaign text[] DEFAULT NULL,
  p_original_utm_medium text[] DEFAULT NULL, p_original_utm_content text[] DEFAULT NULL,
  p_original_utm_term text[] DEFAULT NULL
) RETURNS TABLE(
  total_leads bigint, attempted bigint, connected bigint, engaged bigint,
  qualified bigint, hot bigint, warm bigint, callback_pending bigint
)
LANGUAGE sql STABLE SECURITY DEFINER AS $function$
  WITH stages AS (
    SELECT COALESCE(lead_stage, 'Not Yet Called') AS stage FROM upgrad_active_leads
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
    SELECT COALESCE(lead_stage, 'Not Yet Called') FROM upgrad_archived_leads
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
  )
  SELECT count(*),
         count(*) FILTER (WHERE stage <> 'Not Yet Called'),
         count(*) FILTER (WHERE stage NOT IN ('Not Yet Called','AI Bot Reached - DNP')),
         count(*) FILTER (WHERE stage IN (
           'AI Bot Qualified - High Intent','AI Bot Qualified - Warm',
           'AI Bot Reached - CB Later','AI Bot Called - Not Interested','AI Bot Called - Not Eligible'
         )),
         count(*) FILTER (WHERE stage IN ('AI Bot Qualified - High Intent','AI Bot Qualified - Warm')),
         count(*) FILTER (WHERE stage = 'AI Bot Qualified - High Intent'),
         count(*) FILTER (WHERE stage = 'AI Bot Qualified - Warm'),
         count(*) FILTER (WHERE stage = 'AI Bot Reached - CB Later')
  FROM stages;
$function$;

GRANT EXECUTE ON FUNCTION public.client_funnel_filtered(text[],text[],text[],text[],text[],text[],text[],text[],text[],text[],text[])
  TO authenticated, anon, service_role;
