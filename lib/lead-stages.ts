// Lead stage metadata — display label, short description, and a stable color.
// All stage strings here MUST match SPEC.md §16.1 exactly (n8n writes them).
import { LEAD_STAGES, type LeadStage } from './constants';

type StageMeta = {
  label: string;
  description: string;
  color: string;
  /** Tone for badges. */
  tone: 'hot' | 'warm' | 'cold' | 'neutral' | 'caution' | 'positive';
};

// Palette updated for higher chromatic differentiation across the donut.
// Each stage gets a distinct hue from the Tailwind colour wheel so even small slices
// pop against the dominant "Did Not Pick" majority slice.
const META: Record<string, StageMeta> = {
  // Labels are intentionally the raw lead_stage strings — UGSOT request 2026-05-23:
  // "the disposition names should be as per the lead_stage". No prettification.
  'AI Bot Qualified - High Intent': {
    label: 'AI Bot Qualified - High Intent',
    description: 'Strong interest signals. Highest conversion priority.',
    color: '#dc2626', // red-600
    tone: 'hot'
  },
  'AI Bot Qualified - Warm': {
    label: 'AI Bot Qualified - Warm',
    description: 'Engaged but not yet committed. Worth nurturing.',
    color: '#f59e0b', // amber-500
    tone: 'warm'
  },
  'AI Bot Qualified - Low Interest': {
    label: 'AI Bot Qualified - Low Interest',
    description: 'Engaged but unlikely to convert.',
    color: '#6366f1', // indigo-500
    tone: 'cold'
  },
  'AI Bot Reached - CB Later': {
    label: 'AI Bot Reached - CB Later',
    description: 'Asked to be called back at a specific time.',
    color: '#0ea5e9', // sky-500
    tone: 'neutral'
  },
  'AI Bot Reached - DNP': {
    label: 'AI Bot Reached - DNP',
    description: 'Phone rang but no answer or call dropped.',
    color: '#94a3b8', // slate-400 — kept muted; this is the dominant slice
    tone: 'neutral'
  },
  'AI Bot Called - Not Interested': {
    label: 'AI Bot Called - Not Interested',
    description: 'Caller explicitly declined.',
    color: '#ec4899', // pink-500
    tone: 'cold'
  },
  'AI Bot Called - Not Eligible': {
    label: 'AI Bot Called - Not Eligible',
    description: 'Did not meet eligibility criteria.',
    color: '#a855f7', // purple-500
    tone: 'caution'
  },
  'AI Bot Sent - Payment Link': {
    label: 'AI Bot Sent - Payment Link',
    description: 'Payment link delivered after conversation.',
    color: '#10b981', // emerald-500
    tone: 'positive'
  },
  'AI Bot Sent - Brochure': {
    label: 'AI Bot Sent - Brochure',
    description: 'Brochure delivered after conversation.',
    color: '#14b8a6', // teal-500
    tone: 'positive'
  },
  'Not Yet Called': {
    label: 'Not Yet Called',
    description: 'Lead ingested but no outbound attempt yet.',
    color: '#d1d5db', // gray-300
    tone: 'neutral'
  }
};

export function stageMeta(stage: string): StageMeta {
  return (
    META[stage] ?? {
      label: stage,
      description: '',
      color: 'rgb(148 163 184)',
      tone: 'neutral'
    }
  );
}

/** URL slug for a lead stage. Stable across deploys. */
export function stageSlugFor(stage: string): string {
  return stage
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Resolve a URL slug back to the canonical lead_stage string. */
export function stageFromSlug(slug: string): string | null {
  for (const s of LEAD_STAGES) {
    if (stageSlugFor(s) === slug) return s;
  }
  if (slug === stageSlugFor('Not Yet Called')) return 'Not Yet Called';
  return null;
}

export type { LeadStage };
