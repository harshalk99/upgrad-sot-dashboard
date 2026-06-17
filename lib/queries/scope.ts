// Resolve a user's effective campaign + source scope for any dashboard query.
// Used by every (client) page to thread { campaigns, scope } into queries
// without each page duplicating the role logic.

import type { CurrentUser } from '@/lib/auth/getUser';
import type { ConnectivityFilters } from '@/lib/queries/client';

/** Compute the campaign filter the user is allowed to ask for.
 *  - super_admin without a pick → null (= all non-excluded campaigns, aggregate).
 *  - super_admin with a pick → [picked] (narrow to one).
 *  - client / digital_partner → their campaignScope; if `picked` is outside
 *    that scope, ignore and fall back to the full scope (never widen).
 *  - client without any scope row → empty array (deny-by-default).
 */
export function resolveCampaignFilter(
  user: CurrentUser,
  picked?: string
): string[] | null {
  if (user.role === 'super_admin') {
    return picked ? [picked] : null;
  }
  const scope = user.campaignScope ?? [];
  if (scope.length === 0) return [];
  if (!picked) return scope;
  return scope.includes(picked) ? [picked] : scope;
}

/** Merge a user's URL-applied source filter with their fixed source scope.
 *  Intersection only — a scoped user can narrow inside their scope but
 *  cannot widen beyond it by editing URL params. */
export function resolveSourceFilter(
  user: CurrentUser,
  urlFilters?: ConnectivityFilters
): ConnectivityFilters {
  const scope = user.sourceScope;
  if (!scope?.length) return urlFilters ?? {};
  if (!urlFilters?.data_source_name?.length) {
    return { ...urlFilters, data_source_name: scope };
  }
  const intersected = urlFilters.data_source_name.filter((s) => scope.includes(s));
  return { ...urlFilters, data_source_name: intersected.length ? intersected : scope };
}

/** Compact shape every query helper now accepts. */
export type ScopeArgs = {
  campaigns: string[] | null;
  scope?: string[];
};

/** When the picked campaign is `visibility=coming_soon` AND the viewer is NOT
 *  a super_admin, return the campaign's display_name so the caller can render
 *  a placeholder instead of running queries. Returns null otherwise. */
export function getComingSoonCampaign(
  user: CurrentUser,
  picked: string | undefined,
  campaigns: { campaign_id: string; display_name: string; visibility: 'all' | 'coming_soon' }[]
): { campaign_id: string; display_name: string } | null {
  if (!picked) return null;
  if (user.role === 'super_admin') return null;
  const c = campaigns.find((x) => x.campaign_id === picked);
  if (!c || c.visibility !== 'coming_soon') return null;
  return { campaign_id: c.campaign_id, display_name: c.display_name };
}
