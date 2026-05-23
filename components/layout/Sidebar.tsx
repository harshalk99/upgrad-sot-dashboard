'use client';

// Sidebar — Kubota-inspired industrial rail. Grouped by section (business / operations / strategic).
// Visibility = (role matches NavItem.roles) AND (dashboard_modules.enabled_for_<role> = true).
// SPEC.md §13: nav source + module filtering.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, type NavItem } from '@/lib/navigation';
import type { UserRole } from '@/lib/auth/userRole';
import { PredixionLogo } from '@/components/branding/PredixionLogo';

type Props = {
  role: UserRole;
  /** module_keys that are enabled for this role (from dashboard_modules). */
  enabledModules: Set<string>;
};

const GROUP_LABELS: Record<NavItem['group'], string> = {
  business: 'Business',
  operations: 'Operations',
  strategic: 'Strategic'
};

export function Sidebar({ role, enabledModules }: Props) {
  const pathname = usePathname();

  const visible = NAV_ITEMS.filter(
    (item) => item.roles.includes(role) && enabledModules.has(item.module_key)
  );

  const groups: Record<NavItem['group'], NavItem[]> = {
    business: [],
    operations: [],
    strategic: []
  };
  for (const item of visible) groups[item.group].push(item);

  return (
    <aside className="hidden w-56 shrink-0 border-r border-border/60 bg-slate-950 text-slate-100 md:flex md:flex-col dark:bg-slate-950">
      <div className="border-b border-slate-800 px-4 py-5">
        <div className="flex flex-col items-start gap-3">
          <PredixionLogo variant="white" size={72} withWordmark />
          <div>
            <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-slate-400">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              UGSOT
            </div>
            <div className="text-sm font-semibold leading-tight">Voice Agent Ops</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {(Object.keys(groups) as NavItem['group'][]).map((g) => {
          const items = groups[g];
          if (items.length === 0) return null;
          return (
            <div key={g} className="mb-4">
              <div className="px-2 pb-1 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">
                {GROUP_LABELS[g]}
              </div>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.href ||
                    (item.href !== '/dashboard' &&
                      item.href !== '/admin' &&
                      item.href !== '/super' &&
                      pathname.startsWith(item.href));
                  return (
                    <li key={`${g}-${item.href}`}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                          active
                            ? 'bg-slate-800 text-white'
                            : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                        )}
                      >
                        <Icon className="size-4 shrink-0 opacity-80" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 px-4 py-3 text-[10px] text-slate-500">
        v0.1 · {role}
      </div>
    </aside>
  );
}
