// Domain constants from SPEC.md §16. DO NOT change strings — n8n workflows
// depend on these exact values being written into upgrad_active_leads.lead_stage.

export const LEAD_STAGES = [
  'AI Bot Qualified - High Intent',
  'AI Bot Qualified - Warm',
  'AI Bot Qualified - Low Interest',
  'AI Bot Called - Not Interested',
  'AI Bot Called - Not Eligible',
  'AI Bot Sent - Payment Link',
  'AI Bot Sent - Brochure',
  'AI Bot Reached - DNP',
  'AI Bot Reached - CB Later'
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const ENQUIRY_CLASSIFICATIONS = [
  'HOT',
  'WARM',
  'COLD',
  'NOT_INTERESTED',
  'NOT_ELIGIBLE',
  'CB_LATER',
  'PAYMENT_LINK',
  'BROCHURE',
  'INVALID'
] as const;
export type EnquiryClassification = (typeof ENQUIRY_CLASSIFICATIONS)[number];

export const CALLER_TYPES = ['student', 'parent', 'other', 'wrong_number', 'unknown'] as const;
export type CallerType = (typeof CALLER_TYPES)[number];

export const DISQUALIFICATION_REASONS = [
  'DND',
  'wrong_number',
  'not_eligible',
  'not_interested',
  'max_attempts_no_connect'
] as const;

export const DEFAULT_CAMPAIGN_ID = 'UGSOT_MAY_2026';
