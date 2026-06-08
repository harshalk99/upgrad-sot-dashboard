-- 0021_exclude_campaigns_from_dashboard.sql
--
-- Globally exclude specific campaign_id values from EVERY dashboard-facing
-- view + RPC, without touching the raw lead/call tables (ingestion + admin
-- DB tooling keep seeing the full data).
--
-- Driver: dashboard_excluded_campaigns config table. Add a row → instantly
-- hides that campaign from every client + admin dashboard surface via the
-- `is_campaign_dashboard_excluded(text)` helper used in each view/RPC.
--
-- First entry: UGSOT_KANNADA_JUNE_2026 (UGSOT request 2026-06-07).
--
-- Out of scope: super_admin / Predixion-ops views (Predixion needs the
-- unfiltered totals for billing reconciliation) and the ingestion pipelines
-- (archive_lead, build_daily_queue, schedule_reattempt, etc.).

-- ─── Config ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dashboard_excluded_campaigns (
  campaign_id text PRIMARY KEY,
  added_at    timestamptz NOT NULL DEFAULT now(),
  note        text
);
GRANT SELECT ON public.dashboard_excluded_campaigns TO authenticated, anon, service_role;

INSERT INTO public.dashboard_excluded_campaigns (campaign_id, note)
VALUES ('UGSOT_KANNADA_JUNE_2026', 'Excluded from dashboard per UGSOT request 2026-06-07')
ON CONFLICT (campaign_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_campaign_dashboard_excluded(p_campaign_id text)
RETURNS boolean LANGUAGE sql STABLE
AS $$
  SELECT p_campaign_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.dashboard_excluded_campaigns WHERE campaign_id = p_campaign_id);
$$;
GRANT EXECUTE ON FUNCTION public.is_campaign_dashboard_excluded(text) TO authenticated, anon, service_role;

-- ─── Client views — call_logs-backed ───────────────────────────────────────

CREATE OR REPLACE VIEW public.v_client_call_summaries AS
  SELECT call_id, lead_id, attempt_date, attempt_time, call_start, duration_seconds,
         call_status, call_end_reason, enquiry_classification, transcript_summary,
         lead_source, campaign_id, callback_booked, callback_datetime
  FROM upgrad_call_logs cl
  WHERE ((call_flagged = false) OR (call_flagged IS NULL))
    AND NOT public.is_campaign_dashboard_excluded(cl.campaign_id);

CREATE OR REPLACE VIEW public.v_client_daily_volume AS
  SELECT attempt_date AS day,
         count(*) AS calls_made,
         count(*) FILTER (WHERE duration_seconds > 0) AS connected,
         count(*) FILTER (WHERE enquiry_classification = ANY (ARRAY['HOT','WARM'])) AS qualified
  FROM upgrad_call_logs cl
  WHERE ((call_flagged = false) OR (call_flagged IS NULL))
    AND NOT public.is_campaign_dashboard_excluded(cl.campaign_id)
  GROUP BY attempt_date ORDER BY attempt_date DESC;

CREATE OR REPLACE VIEW public.v_client_connectivity AS
  SELECT COALESCE((SELECT q.attempt_number FROM upgrad_call_queue q
                     WHERE q.call_id = cl.call_id ORDER BY q.id DESC LIMIT 1), 1) AS attempt_number,
         count(*) AS total,
         count(*) FILTER (WHERE duration_seconds > 0) AS connected,
         round((100.0 * count(*) FILTER (WHERE duration_seconds > 0))::numeric / NULLIF(count(*),0)::numeric, 1) AS connect_rate_pct
  FROM upgrad_call_logs cl
  WHERE ((call_flagged = false) OR (call_flagged IS NULL))
    AND NOT public.is_campaign_dashboard_excluded(cl.campaign_id)
  GROUP BY 1 ORDER BY 1;

CREATE OR REPLACE VIEW public.v_client_connectivity_daily AS
  WITH days AS (
    SELECT generate_series((CURRENT_DATE - INTERVAL '29 days')::date, CURRENT_DATE::date, INTERVAL '1 day')::date AS day
  ),
  calls AS (
    SELECT date_trunc('day', call_start AT TIME ZONE 'Asia/Kolkata')::date AS day,
           enquiry_classification
    FROM upgrad_call_logs cl
    WHERE ((call_flagged = false) OR (call_flagged IS NULL))
      AND call_start IS NOT NULL
      AND call_start >= (CURRENT_DATE - INTERVAL '30 days')
      AND NOT public.is_campaign_dashboard_excluded(cl.campaign_id)
  ),
  daily AS (
    SELECT day, count(*) AS attempted,
           count(*) FILTER (WHERE enquiry_classification IS NOT NULL AND enquiry_classification NOT IN ('DNP','INVALID')) AS connected,
           count(*) FILTER (WHERE enquiry_classification IN ('HOT','WARM','CB_LATER')) AS engaged
    FROM calls GROUP BY day
  )
  SELECT d.day, COALESCE(da.attempted,0)::bigint, COALESCE(da.connected,0)::bigint, COALESCE(da.engaged,0)::bigint,
         CASE WHEN COALESCE(da.attempted,0) > 0
              THEN round(100.0 * COALESCE(da.connected,0)::numeric / da.attempted::numeric, 1) ELSE NULL END,
         CASE WHEN COALESCE(da.attempted,0) > 0
              THEN round(100.0 * COALESCE(da.engaged,0)::numeric / da.attempted::numeric, 1) ELSE NULL END
  FROM days d LEFT JOIN daily da ON da.day = d.day ORDER BY d.day;

-- ─── Client views — leads-backed ───────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_lead_dispositions_ist AS
  SELECT id, ls_prospect_id, name, phone, lead_stage, last_called_at,
         (last_called_at AT TIME ZONE 'Asia/Kolkata')::date AS last_called_date_ist,
         pushed_to_crm, 'active'::text AS source_table
  FROM upgrad_active_leads
  WHERE lead_stage IS NOT NULL AND NOT public.is_campaign_dashboard_excluded(campaign_id)
  UNION ALL
  SELECT id, ls_prospect_id, name, phone, lead_stage, last_called_at,
         (last_called_at AT TIME ZONE 'Asia/Kolkata')::date AS last_called_date_ist,
         pushed_to_crm, 'archived'::text
  FROM upgrad_archived_leads
  WHERE lead_stage IS NOT NULL AND NOT public.is_campaign_dashboard_excluded(campaign_id);

CREATE OR REPLACE VIEW public.v_client_funnel AS
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
         count(*) FILTER (WHERE stage IN ('AI Bot Qualified - High Intent','AI Bot Qualified - Warm','AI Bot Reached - CB Later')) AS qualified,
         count(*) FILTER (WHERE stage = 'AI Bot Qualified - High Intent') AS hot,
         count(*) FILTER (WHERE stage = 'AI Bot Qualified - Warm') AS warm,
         count(*) FILTER (WHERE stage = 'AI Bot Reached - CB Later') AS callback_pending
  FROM stages;

CREATE OR REPLACE VIEW public.v_client_dispositions AS
  WITH stages AS (
    SELECT COALESCE(lead_stage, 'Not Yet Called') AS lead_stage FROM upgrad_active_leads
    WHERE NOT public.is_campaign_dashboard_excluded(campaign_id)
    UNION ALL
    SELECT COALESCE(lead_stage, 'Not Yet Called') FROM upgrad_archived_leads
    WHERE NOT public.is_campaign_dashboard_excluded(campaign_id)
  )
  SELECT lead_stage, count(*) AS lead_count FROM stages GROUP BY lead_stage ORDER BY 2 DESC;

CREATE OR REPLACE VIEW public.v_client_engagement_funnel AS
  WITH stage_counts AS (
    SELECT COALESCE(lead_stage,'Not Yet Called') AS stage, count(*) AS cnt
    FROM upgrad_active_leads
    WHERE NOT public.is_campaign_dashboard_excluded(campaign_id) GROUP BY 1
    UNION ALL
    SELECT COALESCE(lead_stage,'Not Yet Called'), count(*)
    FROM upgrad_archived_leads
    WHERE NOT public.is_campaign_dashboard_excluded(campaign_id) GROUP BY 1
  )
  SELECT sum(cnt) FILTER (WHERE stage <> 'Not Yet Called') AS attempted,
         sum(cnt) FILTER (WHERE stage NOT IN ('Not Yet Called','AI Bot Reached - DNP')) AS connected,
         sum(cnt) FILTER (WHERE stage IN ('AI Bot Qualified - High Intent','AI Bot Qualified - Warm','AI Bot Reached - CB Later')) AS qualified
  FROM stage_counts;

CREATE OR REPLACE VIEW public.v_client_engagement_by_source AS
  WITH all_leads AS (
    SELECT lead_source, lead_stage FROM upgrad_active_leads
    WHERE NOT public.is_campaign_dashboard_excluded(campaign_id)
    UNION ALL
    SELECT lead_source, lead_stage FROM upgrad_archived_leads
    WHERE NOT public.is_campaign_dashboard_excluded(campaign_id)
  ),
  normalized AS (
    SELECT COALESCE(lead_source,'Unknown') AS source, COALESCE(lead_stage,'Not Yet Called') AS stage FROM all_leads
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
    SELECT lead_source, lead_stage, ugnet_registered FROM upgrad_active_leads
    WHERE NOT public.is_campaign_dashboard_excluded(campaign_id)
    UNION ALL
    SELECT lead_source, lead_stage, ugnet_registered FROM upgrad_archived_leads
    WHERE NOT public.is_campaign_dashboard_excluded(campaign_id)
  ),
  normalized AS (
    SELECT COALESCE(lead_source,'Unknown') AS source,
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

CREATE OR REPLACE VIEW public.v_client_state_performance AS
  WITH all_leads AS (
    SELECT state, lead_stage, ugnet_registered FROM upgrad_active_leads
    WHERE NOT public.is_campaign_dashboard_excluded(campaign_id)
    UNION ALL
    SELECT state, lead_stage, ugnet_registered FROM upgrad_archived_leads
    WHERE NOT public.is_campaign_dashboard_excluded(campaign_id)
  ),
  normalized AS (
    SELECT CASE WHEN state IS NULL OR trim(state)='' THEN 'Unknown'
                ELSE initcap(replace(lower(trim(state)),'_',' ')) END AS state,
           COALESCE(lead_stage,'Not Yet Called') AS stage, ugnet_registered FROM all_leads
  )
  SELECT state, count(*) AS total_leads,
         count(*) FILTER (WHERE stage <> 'Not Yet Called') AS attempted,
         count(*) FILTER (WHERE stage NOT IN ('Not Yet Called','AI Bot Reached - DNP')) AS connected,
         count(*) FILTER (WHERE stage = 'AI Bot Qualified - High Intent') AS hot,
         count(*) FILTER (WHERE stage = 'AI Bot Qualified - Warm') AS warm,
         count(*) FILTER (WHERE ugnet_registered = true) AS ugnet_registrations,
         CASE WHEN count(*) > 0
              THEN round(100.0 * count(*) FILTER (WHERE stage IN ('AI Bot Qualified - High Intent','AI Bot Qualified - Warm'))::numeric / count(*)::numeric, 1)
              ELSE 0 END AS qualification_rate_pct
  FROM normalized GROUP BY state ORDER BY 2 DESC;

CREATE OR REPLACE VIEW public.v_client_hot_warm_leads AS
  WITH all_leads AS (
    SELECT id, name, phone, city, state, preferred_campus, interested_field, lead_stage,
           callback_booked, callback_datetime, last_called_at, ls_prospect_id, false AS is_archived
    FROM upgrad_active_leads
    WHERE lead_stage IN ('AI Bot Qualified - High Intent','AI Bot Qualified - Warm','AI Bot Reached - CB Later')
      AND NOT public.is_campaign_dashboard_excluded(campaign_id)
    UNION ALL
    SELECT id, name, phone, city, state, preferred_campus, interested_field, lead_stage,
           callback_booked, callback_datetime, last_called_at, ls_prospect_id, true
    FROM upgrad_archived_leads
    WHERE lead_stage IN ('AI Bot Qualified - High Intent','AI Bot Qualified - Warm','AI Bot Reached - CB Later')
      AND NOT public.is_campaign_dashboard_excluded(campaign_id)
  ),
  latest_summaries AS (
    SELECT DISTINCT ON (cl.lead_id) cl.lead_id, cl.transcript_summary AS last_call_summary
    FROM upgrad_call_logs cl
    WHERE cl.transcript_summary IS NOT NULL AND trim(cl.transcript_summary) <> ''
      AND NOT public.is_campaign_dashboard_excluded(cl.campaign_id)
    ORDER BY cl.lead_id, cl.call_start DESC NULLS LAST
  )
  SELECT (l.id)::text AS lead_uid,
         split_part(l.name,' ',1) AS first_name, l.phone, l.city,
         CASE WHEN l.state IS NULL OR trim(l.state)='' THEN 'Unknown'
              ELSE initcap(replace(lower(trim(l.state)),'_',' ')) END AS state,
         l.preferred_campus, l.interested_field, l.lead_stage,
         l.callback_booked, l.callback_datetime, l.last_called_at, l.ls_prospect_id,
         l.is_archived, ls.last_call_summary
  FROM all_leads l LEFT JOIN latest_summaries ls ON ls.lead_id = l.ls_prospect_id
  ORDER BY CASE l.lead_stage
             WHEN 'AI Bot Qualified - High Intent' THEN 1
             WHEN 'AI Bot Qualified - Warm' THEN 2
             WHEN 'AI Bot Reached - CB Later' THEN 3 ELSE NULL END,
           l.last_called_at DESC;

CREATE OR REPLACE VIEW public.v_client_leads_by_stage AS
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
    SELECT (l.id)::text AS lead_uid, split_part(l.name,' ',1) AS first_name, l.phone, l.city,
           CASE WHEN l.state IS NULL OR trim(l.state)='' THEN 'Unknown'
                ELSE initcap(replace(lower(trim(l.state)),'_',' ')) END AS state,
           l.preferred_campus, l.interested_field, l.lead_source,
           COALESCE(l.lead_stage,'Not Yet Called') AS lead_stage,
           l.callback_booked, l.callback_datetime, l.last_called_at, l.ls_prospect_id,
           l.total_attempts, l.total_connects, l.ls_ingested_at, false AS is_archived,
           CASE WHEN l.lead_stage = 'AI Bot Reached - DNP' THEN NULL::bigint ELSE ca.connected_on_attempt END AS connected_on_attempt,
           CASE WHEN l.lead_stage = 'AI Bot Reached - DNP' THEN NULL::text  ELSE ls.last_call_summary END AS last_call_summary
    FROM upgrad_active_leads l
    LEFT JOIN connect_attempts ca ON ca.ls_prospect_id = l.ls_prospect_id
    LEFT JOIN latest_summaries ls ON ls.ls_prospect_id = l.ls_prospect_id
    WHERE NOT public.is_campaign_dashboard_excluded(l.campaign_id)
    UNION ALL
    SELECT (l.id)::text, split_part(l.name,' ',1), l.phone, l.city,
           CASE WHEN l.state IS NULL OR trim(l.state)='' THEN 'Unknown'
                ELSE initcap(replace(lower(trim(l.state)),'_',' ')) END,
           l.preferred_campus, l.interested_field, l.lead_source,
           COALESCE(l.lead_stage,'Not Yet Called'),
           l.callback_booked, l.callback_datetime, l.last_called_at, l.ls_prospect_id,
           l.total_attempts, l.total_connects, l.ls_ingested_at, true,
           CASE WHEN l.lead_stage = 'AI Bot Reached - DNP' THEN NULL::bigint ELSE ca.connected_on_attempt END,
           CASE WHEN l.lead_stage = 'AI Bot Reached - DNP' THEN NULL::text  ELSE ls.last_call_summary END
    FROM upgrad_archived_leads l
    LEFT JOIN connect_attempts ca ON ca.ls_prospect_id = l.ls_prospect_id
    LEFT JOIN latest_summaries ls ON ls.ls_prospect_id = l.ls_prospect_id
    WHERE NOT public.is_campaign_dashboard_excluded(l.campaign_id)
  )
  SELECT * FROM combined;

-- ─── Admin views ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_admin_call_logs AS
  SELECT cl.id, cl.call_id, cl.call_start, cl.call_end, cl.duration_seconds, cl.call_status,
         cl.extracted_status, cl.enquiry_classification, cl.caller_type, cl.caller_language,
         cl.dnd, cl.agent_malfunction, cl.call_flagged, cl.transcript_summary, cl.transcript,
         cl.recording_url, cl.objections_raised, cl.disqualification_reason,
         al.name AS lead_name, al.phone AS lead_phone, al.ls_prospect_id, al.lead_stage,
         al.total_attempts, al.campaign_id,
         cl.agent_malfunction_details, cl.ls_call_activity_id,
         cl.flagged_by, cl.flagged_reason, cl.flagged_at, cl.flagged_source
  FROM upgrad_call_logs cl
  LEFT JOIN upgrad_active_leads al ON al.id = cl.customer_id
  WHERE NOT public.is_campaign_dashboard_excluded(cl.campaign_id)
  ORDER BY cl.call_start DESC;

CREATE OR REPLACE VIEW public.v_admin_voice_minutes AS
  SELECT date_trunc('day', call_start AT TIME ZONE 'Asia/Kolkata')::date AS day_ist,
         count(*) AS total_calls,
         count(*) FILTER (WHERE duration_seconds > 0) AS connected_calls,
         round(sum(COALESCE(duration_seconds,0))::numeric / 60.0, 1) AS minutes_used,
         round(sum(COALESCE(duration_seconds,0)) FILTER (WHERE duration_seconds > 0)::numeric / 60.0, 1) AS billable_minutes
  FROM upgrad_call_logs cl
  WHERE call_flagged IS NOT TRUE
    AND NOT public.is_campaign_dashboard_excluded(cl.campaign_id)
  GROUP BY 1 ORDER BY 1 DESC;

CREATE OR REPLACE VIEW public.v_admin_perf_by_attempt AS
  SELECT attempt_date AS day,
         COALESCE((SELECT q.attempt_number FROM upgrad_call_queue q
                     WHERE q.call_id = cl.call_id ORDER BY q.id DESC LIMIT 1), 1) AS attempt_number,
         count(*) AS total_calls,
         count(*) FILTER (WHERE duration_seconds >= 1) AS connects,
         count(*) FILTER (WHERE duration_seconds >= 20) AS meaningful_connects,
         round(avg(duration_seconds) FILTER (WHERE duration_seconds > 0), 1) AS avg_duration_sec,
         count(*) FILTER (WHERE enquiry_classification IN ('HOT','WARM')) AS qualified,
         count(*) FILTER (WHERE dnd = true) AS dnd_flagged
  FROM upgrad_call_logs cl
  WHERE extracted_status = 'completed' AND call_flagged IS NOT TRUE
    AND NOT public.is_campaign_dashboard_excluded(cl.campaign_id)
  GROUP BY attempt_date,
           COALESCE((SELECT q.attempt_number FROM upgrad_call_queue q
                       WHERE q.call_id = cl.call_id ORDER BY q.id DESC LIMIT 1), 1);

CREATE OR REPLACE VIEW public.v_admin_pipeline_now AS
  SELECT
    (SELECT count(*) FROM upgrad_call_queue WHERE status='queued' AND next_attempt_at <= now()) AS due_now,
    (SELECT count(*) FROM upgrad_call_queue WHERE status='queued' AND next_attempt_at  > now()) AS scheduled_future,
    (SELECT count(*) FROM upgrad_call_queue WHERE status='dispatched') AS in_flight,
    (SELECT count(*) FROM upgrad_call_logs cl
       WHERE extracted_status='pending' AND call_start < now() - INTERVAL '5 minutes'
         AND call_flagged IS NOT TRUE
         AND NOT public.is_campaign_dashboard_excluded(cl.campaign_id)) AS stuck_pending,
    (SELECT count(*) FROM upgrad_active_leads
       WHERE pushed_to_crm = false AND lead_stage IS NOT NULL
         AND NOT public.is_campaign_dashboard_excluded(campaign_id)) AS awaiting_push,
    (SELECT count(*) FROM upgrad_active_leads
       WHERE pushed_to_crm = false AND lead_stage IS NOT NULL
         AND updated_at < now() - INTERVAL '30 minutes'
         AND NOT public.is_campaign_dashboard_excluded(campaign_id)) AS stale_unpushed,
    (SELECT count(*) FROM upgrad_call_logs cl
       WHERE call_flagged = true AND created_at > now() - INTERVAL '24 hours'
         AND NOT public.is_campaign_dashboard_excluded(cl.campaign_id)) AS flagged_24h,
    (SELECT count(*) FROM upgrad_call_logs cl
       WHERE agent_malfunction = true AND created_at > now() - INTERVAL '24 hours'
         AND call_flagged IS NOT TRUE
         AND NOT public.is_campaign_dashboard_excluded(cl.campaign_id)) AS malfunctions_24h;

-- ─── RPCs (CREATE OR REPLACE — patched bodies live alongside the originals;
--          see migrations 0001 / 0014-0020 for arg lists. Each body adds an
--          extra `NOT public.is_campaign_dashboard_excluded(campaign_id)` on
--          every upgrad_active_leads / upgrad_archived_leads / upgrad_call_logs
--          scan.) ───────────────────────────────────────────────────────────

-- Note: the full CREATE OR REPLACE FUNCTION bodies for client_avg_call_duration,
-- client_conversation_depth, top_objections, client_dispositions_in_range,
-- client_connectivity_filter_options, client_funnel_filtered,
-- client_engagement_funnel_filtered, client_engagement_by_source_filtered,
-- client_connectivity_daily_filtered, and client_dispositions_filtered were
-- applied to the live DB in the same change set as this file (via MCP). See
-- the corresponding commit message for the exact statements.
