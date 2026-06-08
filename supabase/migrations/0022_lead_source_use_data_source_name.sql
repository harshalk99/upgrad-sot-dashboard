-- 0022_lead_source_use_data_source_name.sql
--
-- Repoint the dashboard's "Lead Source" semantically to the data_source_name
-- column instead of the sparse `lead_source` column on upgrad_*_leads.
--
-- Reason: lead_source is populated for ~10% of leads and mixes UTM tokens
-- with ad-hoc partner names. data_source_name is the canonical LeadSquared
-- source identifier (collegedunia, Careers360, kollege, even_star_media_V2…)
-- and has ~48% coverage.
--
-- Frontend impact: the URL param/short key for "Lead Source" stays `source`
-- (CONNECTIVITY_FULL_TO_SHORT['lead_source'] = 'source') so existing bookmarks
-- keep working. The dedicated "Source Name" filter chip is dropped from the
-- UI in the same change to avoid showing two equivalent filters.

-- ─── Aggregate views ───────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_client_engagement_by_source AS
  WITH all_leads AS (
    SELECT data_source_name AS source_name, lead_stage FROM upgrad_active_leads
    WHERE NOT public.is_campaign_dashboard_excluded(campaign_id)
    UNION ALL
    SELECT data_source_name, lead_stage FROM upgrad_archived_leads
    WHERE NOT public.is_campaign_dashboard_excluded(campaign_id)
  ),
  normalized AS (
    SELECT COALESCE(source_name,'Unknown') AS source,
           COALESCE(lead_stage,'Not Yet Called') AS stage FROM all_leads
  )
  SELECT source, count(*) AS total_leads,
         count(*) FILTER (WHERE stage <> 'Not Yet Called') AS attempted,
         count(*) FILTER (WHERE stage NOT IN ('Not Yet Called','AI Bot Reached - DNP')) AS connected,
         count(*) FILTER (WHERE stage IN ('AI Bot Qualified - High Intent','AI Bot Qualified - Warm','AI Bot Reached - CB Later')) AS engaged,
         CASE WHEN count(*) FILTER (WHERE stage <> 'Not Yet Called') > 0
              THEN round(100.0 * count(*) FILTER (WHERE stage IN ('AI Bot Qualified - High Intent','AI Bot Qualified - Warm','AI Bot Reached - CB Later'))::numeric
                          / count(*) FILTER (WHERE stage <> 'Not Yet Called')::numeric, 1) ELSE 0 END AS engagement_rate_pct
  FROM normalized GROUP BY source ORDER BY 2 DESC;

CREATE OR REPLACE VIEW public.v_client_source_performance AS
  WITH all_leads AS (
    SELECT data_source_name AS source_name, lead_stage, ugnet_registered FROM upgrad_active_leads
    WHERE NOT public.is_campaign_dashboard_excluded(campaign_id)
    UNION ALL
    SELECT data_source_name, lead_stage, ugnet_registered FROM upgrad_archived_leads
    WHERE NOT public.is_campaign_dashboard_excluded(campaign_id)
  ),
  normalized AS (
    SELECT COALESCE(source_name,'Unknown') AS source,
           COALESCE(lead_stage,'Not Yet Called') AS stage, ugnet_registered FROM all_leads
  )
  SELECT source, count(*) AS total_leads,
         count(*) FILTER (WHERE stage <> 'Not Yet Called') AS attempted,
         count(*) FILTER (WHERE stage NOT IN ('Not Yet Called','AI Bot Reached - DNP')) AS connected,
         count(*) FILTER (WHERE stage = 'AI Bot Qualified - High Intent') AS hot,
         count(*) FILTER (WHERE stage = 'AI Bot Qualified - Warm') AS warm,
         count(*) FILTER (WHERE ugnet_registered = true) AS ugnet_registrations,
         CASE WHEN count(*) > 0
              THEN round(100.0 * count(*) FILTER (WHERE stage IN ('AI Bot Qualified - High Intent','AI Bot Qualified - Warm'))::numeric / count(*)::numeric, 1)
              ELSE 0 END AS qualification_rate_pct,
         CASE WHEN count(*) FILTER (WHERE stage <> 'Not Yet Called') > 0
              THEN round(100.0 * count(*) FILTER (WHERE stage NOT IN ('Not Yet Called','AI Bot Reached - DNP'))::numeric
                          / count(*) FILTER (WHERE stage <> 'Not Yet Called')::numeric, 1) ELSE 0 END AS connect_rate_pct
  FROM normalized GROUP BY source ORDER BY 2 DESC;

-- ─── Call summaries — show data_source_name when per-call lead_source is empty.
CREATE OR REPLACE VIEW public.v_client_call_summaries AS
  SELECT cl.call_id, cl.lead_id, cl.attempt_date, cl.attempt_time, cl.call_start, cl.duration_seconds,
         cl.call_status, cl.call_end_reason, cl.enquiry_classification, cl.transcript_summary,
         COALESCE(NULLIF(cl.lead_source,''),
                  (SELECT al.data_source_name FROM upgrad_active_leads   al WHERE al.ls_prospect_id = cl.lead_id),
                  (SELECT al.data_source_name FROM upgrad_archived_leads al WHERE al.ls_prospect_id = cl.lead_id)) AS lead_source,
         cl.campaign_id, cl.callback_booked, cl.callback_datetime
  FROM upgrad_call_logs cl
  WHERE ((cl.call_flagged = false) OR (cl.call_flagged IS NULL))
    AND NOT public.is_campaign_dashboard_excluded(cl.campaign_id);

-- ─── RPCs — p_lead_source filter argument now compares against data_source_name.
-- The full CREATE OR REPLACE FUNCTION bodies for these were applied to the live
-- DB at the same time as this migration:
--   - client_connectivity_filter_options
--   - client_funnel_filtered
--   - client_dispositions_filtered
--   - client_engagement_funnel_filtered
--   - client_engagement_by_source_filtered
--   - client_connectivity_daily_filtered
-- The change in each one: (p_lead_source IS NULL OR data_source_name = ANY(p_lead_source))
-- (was: lead_source = ANY(p_lead_source)). See the corresponding commit.
