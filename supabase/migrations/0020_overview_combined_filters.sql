-- 0020_overview_combined_filters.sql
--
-- Adds two RPCs so the Lead Funnel + Disposition breakdown cards on the
-- client Overview can both be sliced by the same source/UTM dimensions
-- (the 11-dim ConnectivityFilters already in use on /dashboard/connectivity).
--
-- 1. client_funnel_filtered(...)    — same 7 columns as v_client_funnel
-- 2. client_dispositions_filtered(p_from, p_to, ...11 dims)
--    — combined date + source/UTM, IST-bucketed.

CREATE OR REPLACE FUNCTION public.client_funnel_filtered(
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
)
RETURNS TABLE(
  total_leads bigint,
  attempted bigint,
  connected bigint,
  qualified bigint,
  hot bigint,
  warm bigint,
  callback_pending bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
  WITH stages AS (
    SELECT COALESCE(lead_stage, 'Not Yet Called') AS stage FROM upgrad_active_leads
    WHERE (p_lead_source              IS NULL OR lead_source              = ANY(p_lead_source))
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
    WHERE (p_lead_source              IS NULL OR lead_source              = ANY(p_lead_source))
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
  SELECT
    count(*)                                                                                             AS total_leads,
    count(*) FILTER (WHERE stage <> 'Not Yet Called')                                                    AS attempted,
    count(*) FILTER (WHERE stage NOT IN ('Not Yet Called','AI Bot Reached - DNP'))                       AS connected,
    count(*) FILTER (WHERE stage IN ('AI Bot Qualified - High Intent','AI Bot Qualified - Warm','AI Bot Reached - CB Later')) AS qualified,
    count(*) FILTER (WHERE stage = 'AI Bot Qualified - High Intent')                                      AS hot,
    count(*) FILTER (WHERE stage = 'AI Bot Qualified - Warm')                                             AS warm,
    count(*) FILTER (WHERE stage = 'AI Bot Reached - CB Later')                                           AS callback_pending
  FROM stages;
$function$;

GRANT EXECUTE ON FUNCTION public.client_funnel_filtered(text[],text[],text[],text[],text[],text[],text[],text[],text[],text[],text[])
  TO authenticated, anon, service_role;


CREATE OR REPLACE FUNCTION public.client_dispositions_filtered(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
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
)
RETURNS TABLE(lead_stage text, lead_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
  WITH src AS (
    SELECT lead_stage, last_called_at,
           lead_source, data_acquisition_channel, data_source_type, data_source_name,
           data_source_batch, utm_source, original_utm_source, original_utm_campaign,
           original_utm_medium, original_utm_content, original_utm_term
    FROM upgrad_active_leads
    UNION ALL
    SELECT lead_stage, last_called_at,
           lead_source, data_acquisition_channel, data_source_type, data_source_name,
           data_source_batch, utm_source, original_utm_source, original_utm_campaign,
           original_utm_medium, original_utm_content, original_utm_term
    FROM upgrad_archived_leads
  )
  SELECT
    COALESCE(lead_stage, 'Not Yet Called') AS lead_stage,
    count(*) AS lead_count
  FROM src
  WHERE lead_stage IS NOT NULL
    AND lead_stage <> 'Not Yet Called'
    AND (p_from IS NULL OR (last_called_at AT TIME ZONE 'Asia/Kolkata')::date >= p_from)
    AND (p_to   IS NULL OR (last_called_at AT TIME ZONE 'Asia/Kolkata')::date <= p_to)
    AND (p_lead_source              IS NULL OR lead_source              = ANY(p_lead_source))
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
  GROUP BY 1
  ORDER BY 2 DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.client_dispositions_filtered(date,date,text[],text[],text[],text[],text[],text[],text[],text[],text[],text[],text[])
  TO authenticated, anon, service_role;
