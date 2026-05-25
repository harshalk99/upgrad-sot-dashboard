// Canonical lead_stage values used across the dashboard.
// Lives in its own file (not in lib/queries/mutations.ts) because that file
// is tagged `'use server'`, which restricts exports to async functions only.
// Importing constants/types from a server-action file breaks at runtime in
// Next 16 — pages that depend on the chain crash with "page couldn't load".

export const VALID_LEAD_STAGES = [
  'AI Bot Qualified - High Intent',
  'AI Bot Qualified - Warm',
  'AI Bot Qualified - Low Interest',
  'AI Bot Called - Not Interested',
  'AI Bot Called - Not Eligible',
  'AI Bot Reached - DNP',
  'AI Bot Reached - CB Later',
  'AI Bot Sent - Payment Link',
  'AI Bot Sent - Brochure'
] as const;

export type LeadStageValue = (typeof VALID_LEAD_STAGES)[number];
