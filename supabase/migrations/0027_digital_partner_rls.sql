-- 0027_digital_partner_rls.sql
--
-- 0001 wrote RLS policies on dashboard_modules and dashboard_campaign_allocations
-- that hardcoded the three legacy roles (client/admin/super_admin). The new
-- digital_partner role didn't match any branch, so DP sessions saw an empty
-- sidebar (no rows out of dashboard_modules) and zero allocations.
--
-- Extend both policies to treat digital_partner as client-level (same module
-- visibility, same allocation read). Applied live via MCP on 2026-06-17.

DROP POLICY IF EXISTS "users see modules per role" ON public.dashboard_modules;
CREATE POLICY "users see modules per role" ON public.dashboard_modules
FOR SELECT TO authenticated USING (
  (current_user_role() = 'client'           AND enabled_for_client     = true) OR
  (current_user_role() = 'digital_partner'  AND enabled_for_client     = true) OR
  (current_user_role() = 'admin'            AND enabled_for_admin      = true) OR
  (current_user_role() = 'super_admin'      AND enabled_for_super_admin = true)
);

DROP POLICY IF EXISTS "client reads allocations" ON public.dashboard_campaign_allocations;
CREATE POLICY "client reads allocations" ON public.dashboard_campaign_allocations
FOR SELECT TO authenticated USING (
  current_user_role() = ANY (ARRAY['client'::text, 'digital_partner'::text, 'admin'::text, 'super_admin'::text])
);
