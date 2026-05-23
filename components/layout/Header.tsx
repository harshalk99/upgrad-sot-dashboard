// Header — page title bar, sits above content, contains the UserMenu on the right.
import type { ReactNode } from 'react';
import { UserMenu } from './UserMenu';
import type { UserRole } from '@/lib/auth/userRole';

type Props = {
  email: string;
  role: UserRole;
  displayName: string | null;
  /** Optional context label shown above the title (e.g. "UGSOT · Client View"). */
  context?: string;
  title: string;
  subtitle?: ReactNode;
  toolbar?: ReactNode;
};

export function Header({ email, role, displayName, context, title, subtitle, toolbar }: Props) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-border/60 bg-background/60 px-6 py-4 backdrop-blur">
      <div>
        {context && (
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {context}
          </div>
        )}
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
      </div>
      <div className="flex items-center gap-2">
        {toolbar}
        <UserMenu email={email} role={role} displayName={displayName} />
      </div>
    </header>
  );
}
