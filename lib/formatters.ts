// Small display helpers reused everywhere.
import { format, formatDistanceToNow } from 'date-fns';

/** Mask a phone for client views: keep last 4 digits. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return phone;
  return `XXXXXX${digits.slice(-4)}`;
}

/** Seconds → "2m 34s" / "12s" */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
}

/** ISO timestamp → "22 May 2026, 14:32" (IST-localized display string). */
export function formatDateTimeIST(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'd MMM yyyy, HH:mm');
  } catch {
    return '—';
  }
}

/** ISO timestamp → "22 May 2026" (date only, no time). */
export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'd MMM yyyy');
  } catch {
    return '—';
  }
}

/** "3 hours ago" style. */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return '—';
  }
}

/** 1234.5 → "1,234.5"; 1234 → "1,234". */
export function formatNumber(n: number | null | undefined, fractionDigits = 0): string {
  if (n == null) return '—';
  return n.toLocaleString('en-IN', { maximumFractionDigits: fractionDigits });
}

/** Percentage helper that keeps a single decimal: 6.2 → "6.2%". */
export function formatPct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n.toFixed(1)}%`;
}

/** Ordinal: 1 → "1st", 2 → "2nd", 3 → "3rd", 11 → "11th". */
export function ordinal(n: number | null | undefined): string {
  if (n == null) return '—';
  const v = Math.floor(n);
  const last2 = Math.abs(v) % 100;
  if (last2 >= 11 && last2 <= 13) return `${v}th`;
  switch (Math.abs(v) % 10) {
    case 1:
      return `${v}st`;
    case 2:
      return `${v}nd`;
    case 3:
      return `${v}rd`;
    default:
      return `${v}th`;
  }
}
