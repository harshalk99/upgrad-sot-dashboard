// Placeholder shown when a non-super-admin picks a campaign whose
// `dashboard_campaigns.visibility` is 'coming_soon'. The campaign is visible
// in the switcher (so the user knows it exists), but its data stays masked
// until Predixion flips it to 'all'.
import { Sparkles } from 'lucide-react';

type Props = {
  campaignDisplayName: string;
};

export function ComingSoonView({ campaignDisplayName }: Props) {
  return (
    <div className="m-6 rounded-lg border border-dashed border-border/60 bg-muted/20 p-12 text-center">
      <Sparkles className="mx-auto size-8 text-muted-foreground" />
      <h2 className="mt-3 text-base font-semibold tracking-tight">
        Data will be visible soon
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{campaignDisplayName}</span> is
        live in the system, but its metrics aren&rsquo;t open to your view yet. Switch back to
        another campaign from the dropdown to keep working.
      </p>
    </div>
  );
}
