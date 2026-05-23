'use client';

// Client-side CSV export buttons for the Reports page. Uses Blob URL.
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { HotWarmLead } from '@/components/tables/LeadsTable';

type FunnelData = {
  total_leads?: number | null;
  attempted?: number | null;
  connected?: number | null;
  qualified?: number | null;
  hot?: number | null;
  warm?: number | null;
  callback_pending?: number | null;
} | null;

type DispositionRow = { lead_stage: string | null; lead_count: number | null };

type Props = {
  funnel: FunnelData;
  dispositions: DispositionRow[];
  leads: HotWarmLead[];
};

function escapeCsv(v: unknown): string {
  if (v == null) return '';
  const s = typeof v === 'string' ? v : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(rows: Record<string, unknown>[], baseName: string) {
  if (rows.length === 0) {
    toast.error('Nothing to export');
    return;
  }
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escapeCsv(r[h])).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${baseName}_${ts}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${baseName}.csv`);
}

export function ReportsActions({ funnel, dispositions, leads }: Props) {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() =>
          downloadCsv(
            [
              {
                total_leads: funnel?.total_leads ?? 0,
                attempted: funnel?.attempted ?? 0,
                connected: funnel?.connected ?? 0,
                qualified: funnel?.qualified ?? 0,
                hot: funnel?.hot ?? 0,
                warm: funnel?.warm ?? 0,
                callback_pending: funnel?.callback_pending ?? 0
              }
            ],
            'funnel_summary'
          )
        }
      >
        <Download className="size-3.5" /> Funnel summary CSV
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() =>
          downloadCsv(
            dispositions.map((d) => ({
              lead_stage: d.lead_stage,
              lead_count: d.lead_count
            })),
            'dispositions'
          )
        }
      >
        <Download className="size-3.5" /> Dispositions CSV
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() =>
          downloadCsv(
            leads.map((l) => ({
              ls_prospect_id: l.ls_prospect_id,
              first_name: l.first_name,
              phone: l.phone,
              city: l.city,
              state: l.state,
              preferred_campus: l.preferred_campus,
              interested_field: l.interested_field,
              lead_stage: l.lead_stage,
              callback_booked: l.callback_booked,
              callback_datetime: l.callback_datetime,
              last_called_at: l.last_called_at
            })),
            'hot_warm_leads'
          )
        }
      >
        <Download className="size-3.5" /> Hot/Warm leads CSV
      </Button>
    </div>
  );
}
