-- 0031_leads_by_stage_canonical_source.sql
--
-- The disposition drill-in's "Lead Source" column was fed by the legacy
-- upgrad_*_leads.lead_source column, which is NULL for ~99% of leads (the
-- canonical source lives in data_source_name — see migration 0022). So the
-- drill-in showed "—" for almost every lead, and for the digital_partner it
-- looked like null-source leads were leaking in (they weren't — they're
-- correctly scoped by data_source_name, just displayed from the wrong column).
--
-- Fix: client_leads_by_stage_filtered now returns
--   COALESCE(data_source_name, NULLIF(lead_source,'')) AS lead_source
-- matching the dashboard-wide "Lead Source = data_source_name" convention.
-- Scope/filter predicates are unchanged. Applied live via MCP 2026-06-18.

CREATE OR REPLACE FUNCTION public.client_leads_by_stage_filtered(
  p_stage text,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_campaign_id text[] DEFAULT NULL,
  p_data_source_name text[] DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 5000
) RETURNS TABLE(
  lead_uid text, first_name text, phone text, city text, state text,
  preferred_campus text, interested_field text, lead_source text, lead_stage text,
  callback_booked boolean, callback_datetime timestamptz, last_called_at timestamptz,
  ls_prospect_id text, total_attempts integer, total_connects integer,
  ls_ingested_at timestamptz, is_archived boolean,
  connected_on_attempt bigint, last_call_summary text
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH lead_calls AS (
    SELECT cl.lead_id, cl.call_id, cl.call_start, cl.transcript_summary, cl.enquiry_classification,
           row_number() OVER (PARTITION BY cl.lead_id ORDER BY cl.call_start) AS call_attempt
    FROM upgrad_call_logs cl
    WHERE ((cl.call_flagged = false) OR (cl.call_flagged IS NULL))
      AND NOT public.is_campaign_dashboard_excluded(cl.campaign_id)
  ),
  connect_attempts AS (
    SELECT lead_id AS ls_prospect_id, min(call_attempt) AS connected_on_attempt
    FROM lead_calls WHERE enquiry_classification IS NOT NULL AND enquiry_classification <> 'INVALID'
    GROUP BY lead_id
  ),
  latest_summaries AS (
    SELECT DISTINCT ON (lc.lead_id) lc.lead_id AS ls_prospect_id, lc.transcript_summary AS last_call_summary
    FROM lead_calls lc
    WHERE lc.transcript_summary IS NOT NULL AND trim(lc.transcript_summary) <> ''
    ORDER BY lc.lead_id, lc.call_attempt DESC
  ),
  combined AS (
    SELECT (l.id)::text AS lead_uid,
           split_part(l.name,' ',1) AS first_name, l.phone, l.city,
           CASE WHEN l.state IS NULL OR trim(l.state)='' THEN 'Unknown'
                ELSE initcap(replace(lower(trim(l.state)),'_',' ')) END AS state,
           l.preferred_campus, l.interested_field,
           COALESCE(l.data_source_name, NULLIF(l.lead_source,'')) AS lead_source,
           COALESCE(l.lead_stage,'Not Yet Called') AS lead_stage,
           l.callback_booked, l.callback_datetime, l.last_called_at, l.ls_prospect_id,
           l.total_attempts, l.total_connects, l.ls_ingested_at, false AS is_archived,
           CASE WHEN l.lead_stage='AI Bot Reached - DNP' THEN NULL::bigint ELSE ca.connected_on_attempt END AS connected_on_attempt,
           CASE WHEN l.lead_stage='AI Bot Reached - DNP' THEN NULL::text  ELSE ls.last_call_summary END AS last_call_summary
    FROM upgrad_active_leads l
    LEFT JOIN connect_attempts ca ON ca.ls_prospect_id = l.ls_prospect_id
    LEFT JOIN latest_summaries ls ON ls.ls_prospect_id = l.ls_prospect_id
    WHERE NOT public.is_campaign_dashboard_excluded(l.campaign_id)
      AND COALESCE(l.lead_stage,'Not Yet Called') = p_stage
      AND (p_campaign_id      IS NULL OR l.campaign_id      = ANY(p_campaign_id))
      AND (p_data_source_name IS NULL OR l.data_source_name = ANY(p_data_source_name))
      AND (p_from IS NULL OR (l.last_called_at AT TIME ZONE 'Asia/Kolkata')::date >= p_from)
      AND (p_to   IS NULL OR (l.last_called_at AT TIME ZONE 'Asia/Kolkata')::date <= p_to)
    UNION ALL
    SELECT (l.id)::text, split_part(l.name,' ',1), l.phone, l.city,
           CASE WHEN l.state IS NULL OR trim(l.state)='' THEN 'Unknown'
                ELSE initcap(replace(lower(trim(l.state)),'_',' ')) END,
           l.preferred_campus, l.interested_field,
           COALESCE(l.data_source_name, NULLIF(l.lead_source,'')),
           COALESCE(l.lead_stage,'Not Yet Called'),
           l.callback_booked, l.callback_datetime, l.last_called_at, l.ls_prospect_id,
           l.total_attempts, l.total_connects, l.ls_ingested_at, true,
           CASE WHEN l.lead_stage='AI Bot Reached - DNP' THEN NULL::bigint ELSE ca.connected_on_attempt END,
           CASE WHEN l.lead_stage='AI Bot Reached - DNP' THEN NULL::text  ELSE ls.last_call_summary END
    FROM upgrad_archived_leads l
    LEFT JOIN connect_attempts ca ON ca.ls_prospect_id = l.ls_prospect_id
    LEFT JOIN latest_summaries ls ON ls.ls_prospect_id = l.ls_prospect_id
    WHERE NOT public.is_campaign_dashboard_excluded(l.campaign_id)
      AND COALESCE(l.lead_stage,'Not Yet Called') = p_stage
      AND (p_campaign_id      IS NULL OR l.campaign_id      = ANY(p_campaign_id))
      AND (p_data_source_name IS NULL OR l.data_source_name = ANY(p_data_source_name))
      AND (p_from IS NULL OR (l.last_called_at AT TIME ZONE 'Asia/Kolkata')::date >= p_from)
      AND (p_to   IS NULL OR (l.last_called_at AT TIME ZONE 'Asia/Kolkata')::date <= p_to)
  )
  SELECT lead_uid, first_name, phone, city, state, preferred_campus, interested_field,
         lead_source, lead_stage, callback_booked, callback_datetime, last_called_at,
         ls_prospect_id, total_attempts, total_connects, ls_ingested_at, is_archived,
         connected_on_attempt, last_call_summary
  FROM combined
  ORDER BY last_called_at DESC NULLS LAST
  OFFSET p_offset LIMIT p_limit;
$$;
GRANT EXECUTE ON FUNCTION public.client_leads_by_stage_filtered(text,date,date,text[],text[],integer,integer) TO authenticated, anon, service_role;
