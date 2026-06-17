-- 0026_multi_campaign_tenancy.sql
--
-- Multi-campaign tenancy:
--   - dashboard_user_campaigns (user_id, campaign_id) — per-user allowlist.
--   - dashboard_user_source_scopes (user_id, allowed_data_source_names[]) — DP scope.
--   - dashboard_campaigns (campaign_id, display_name) — registry for the switcher.
--   - All client_*_filtered RPCs gain a p_campaign_id text[] arg.
--   - New filtered RPCs: client_state_performance_filtered,
--     client_hot_warm_leads_filtered, client_leads_by_stage_filtered.
--   - client_minutes_summary (RPC replacing v_client_minutes_summary).
--   - client_minutes_by_campaign_current_month (calendar-month breakup).
--
-- This file documents what was applied via MCP execute_sql. Applied live
-- to project lcfkznqziubuefwnvqlb on 2026-06-12.

CREATE TABLE IF NOT EXISTS public.dashboard_user_campaigns (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id  text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, campaign_id)
);
GRANT SELECT ON public.dashboard_user_campaigns TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.dashboard_user_source_scopes (
  user_id                   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  allowed_data_source_names text[] NOT NULL,
  created_at                timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dashboard_user_source_scopes TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.dashboard_campaigns (
  campaign_id  text PRIMARY KEY,
  display_name text NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dashboard_campaigns TO authenticated, service_role;

INSERT INTO public.dashboard_campaigns (campaign_id, display_name) VALUES
  ('UGSOT_MAY_2026', 'UGSOT — Main campaign')
ON CONFLICT (campaign_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_user_campaign_scope(p_user_id uuid)
RETURNS text[] LANGUAGE sql STABLE AS $$
  SELECT array_agg(campaign_id ORDER BY campaign_id)
  FROM public.dashboard_user_campaigns WHERE user_id = p_user_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_user_campaign_scope(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_user_source_scope(p_user_id uuid)
RETURNS text[] LANGUAGE sql STABLE AS $$
  SELECT allowed_data_source_names
  FROM public.dashboard_user_source_scopes WHERE user_id = p_user_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_user_source_scope(uuid) TO authenticated, service_role;

-- Seed existing UGSOT client with explicit access to the main campaign.
INSERT INTO public.dashboard_user_campaigns (user_id, campaign_id)
SELECT id, 'UGSOT_MAY_2026' FROM auth.users WHERE email = 'admin@maxxsocialwelfare.org'
ON CONFLICT DO NOTHING;

-- 0001 added a CHECK constraint that only allows ('client','admin','super_admin').
-- Widen to include 'digital_partner' so the new role rows pass validation.
ALTER TABLE public.dashboard_user_roles DROP CONSTRAINT IF EXISTS dashboard_user_roles_role_check;
ALTER TABLE public.dashboard_user_roles
  ADD CONSTRAINT dashboard_user_roles_role_check
  CHECK (role = ANY (ARRAY['client','digital_partner','admin','super_admin']));

-- The full bodies of:
--   client_funnel_filtered, client_dispositions_filtered,
--   client_engagement_funnel_filtered, client_engagement_by_source_filtered,
--   client_connectivity_daily_filtered, client_connectivity_filter_options,
--   client_avg_call_duration, client_conversation_depth, top_objections,
--   client_state_performance_filtered, client_hot_warm_leads_filtered,
--   client_leads_by_stage_filtered, client_minutes_summary,
--   client_minutes_by_campaign_current_month
-- were applied via MCP execute_sql. Each one adds the pattern:
--   AND (p_campaign_id IS NULL OR campaign_id = ANY(p_campaign_id))
-- alongside the existing is_campaign_dashboard_excluded() check.
