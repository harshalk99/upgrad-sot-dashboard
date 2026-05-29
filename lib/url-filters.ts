// Small helpers for encoding/decoding multi-value filter values in URL searchParams.
// Values are comma-separated; commas inside values are not supported (use encodeURIComponent if needed).
// Empty strings and absent keys both decode to undefined so callers can skip them.
//
// IMPORTANT: this file is plain JS used by BOTH the server-rendered page and the
// client filter-bar component. Don't put `'use client'` here — Next 16 turns named
// exports from client modules into proxy refs that aren't readable from server code.

export type FilterValues = Record<string, string[] | undefined>;

// ─── Connectivity filter key maps (shared between page + FilterBar) ────────
// Short keys keep URLs short and avoid leaking schema names. Maps both ways.
export const CONNECTIVITY_FULL_TO_SHORT = {
  lead_source: 'source',
  data_acquisition_channel: 'dac',
  data_source_type: 'dst',
  data_source_name: 'dsn',
  data_source_batch: 'dsb',
  utm_source: 'utm_src',
  original_utm_source: 'utm_osrc',
  original_utm_campaign: 'utm_camp',
  original_utm_medium: 'utm_med',
  original_utm_content: 'utm_cnt',
  original_utm_term: 'utm_term'
} as const satisfies Record<string, string>;

export const CONNECTIVITY_SHORT_TO_FULL: Record<string, string> = Object.fromEntries(
  Object.entries(CONNECTIVITY_FULL_TO_SHORT).map(([full, short]) => [short, full])
);

/** Convert a Next 16 async-resolved searchParams object into a string[]-keyed map. */
export function decodeFiltersFromSearchParams(
  raw: Record<string, string | string[] | undefined>,
  shortKeyToFilterKey: Record<string, string>
): FilterValues {
  const out: FilterValues = {};
  for (const [shortKey, fullKey] of Object.entries(shortKeyToFilterKey)) {
    const v = raw[shortKey];
    if (v == null) continue;
    const str = Array.isArray(v) ? v.join(',') : v;
    if (!str.trim()) continue;
    out[fullKey] = str
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return out;
}

/** Encode a FilterValues object into URLSearchParams using short keys for compactness. */
export function encodeFiltersToSearchParams(
  filters: FilterValues,
  filterKeyToShortKey: Record<string, string>
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [fullKey, vals] of Object.entries(filters)) {
    if (!vals || vals.length === 0) continue;
    const shortKey = filterKeyToShortKey[fullKey] ?? fullKey;
    params.set(shortKey, vals.join(','));
  }
  return params;
}

/** True if every value in `filters` is undefined or an empty array. */
export function hasAnyFilter(filters: FilterValues): boolean {
  return Object.values(filters).some((v) => v && v.length > 0);
}

// ─── Date range filters ────────────────────────────────────────────────────
// Single date range (from / to) encoded as YYYY-MM-DD strings in URL params.
// Prefix is configurable so multiple date filters can co-exist on a page
// (e.g. "dfrom/dto" for disposition, "rfrom/rto" for reports).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type DateRange = {
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
};

export function decodeDateRange(
  raw: Record<string, string | string[] | undefined>,
  prefix = 'd'
): DateRange {
  const fromKey = `${prefix}from`;
  const toKey = `${prefix}to`;
  const fromRaw = Array.isArray(raw[fromKey]) ? raw[fromKey][0] : raw[fromKey];
  const toRaw = Array.isArray(raw[toKey]) ? raw[toKey][0] : raw[toKey];
  const out: DateRange = {};
  if (fromRaw && DATE_RE.test(fromRaw)) out.from = fromRaw;
  if (toRaw && DATE_RE.test(toRaw)) out.to = toRaw;
  return out;
}

export function encodeDateRange(range: DateRange, prefix = 'd'): URLSearchParams {
  const params = new URLSearchParams();
  if (range.from && DATE_RE.test(range.from)) params.set(`${prefix}from`, range.from);
  if (range.to && DATE_RE.test(range.to)) params.set(`${prefix}to`, range.to);
  return params;
}

export function hasDateRange(range: DateRange): boolean {
  return Boolean(range.from || range.to);
}
