'use client';

// UserMenu — dropdown with role-switcher links + sign out.
// SPEC.md §6 "Cross-navigation in user menu":
//   super_admin sees 3 switchers: Strategic / Operations / Client (preview).
//   admin sees 2 switchers: Operations / Client (preview).
//   client sees no switchers.

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, LayoutGrid, Eye, ChartLine, LogOut, User } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import type { UserRole } from '@/lib/auth/userRole';
import { toast } from 'sonner';

type Props = {
  email: string;
  role: UserRole;
  displayName: string | null;
};

function initialsOf(email: string, displayName?: string | null) {
  if (displayName) {
    return displayName
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function UserMenu({ email, role, displayName }: Props) {
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    toast('Signed out');
    router.replace('/login');
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        // type="button" prevents accidental form-submission if any ancestor
        // ever ends up inside a <form> — base-ui's Button doesn't always set it.
        render={<Button type="button" variant="ghost" size="sm" className="gap-2 px-2" />}
      >
        <Avatar className="size-7">
          <AvatarFallback className="font-mono text-xs">
            {initialsOf(email, displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="hidden text-left leading-tight md:block">
          <div className="text-xs">{displayName ?? email}</div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {role.replace('_', ' ')}
          </div>
        </div>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* DropdownMenuLabel renders base-ui's MenuPrimitive.GroupLabel which
            MUST live inside a MenuPrimitive.Group context — wrap accordingly. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col">
              <span className="text-sm">{email}</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {role}
              </span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        {role === 'super_admin' && (
          <>
            <DropdownMenuItem render={<Link href="/super" />} className="gap-2">
              <ChartLine className="size-4" /> Strategic View
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/admin" />} className="gap-2">
              <LayoutGrid className="size-4" /> Operations View
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/dashboard" />} className="gap-2">
              <Eye className="size-4" /> Client View (Preview)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {role === 'admin' && (
          <>
            <DropdownMenuItem render={<Link href="/admin" />} className="gap-2">
              <LayoutGrid className="size-4" /> Operations View
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/dashboard" />} className="gap-2">
              <Eye className="size-4" /> Client View (Preview)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem disabled className="gap-2 opacity-60">
          <User className="size-4" /> Account settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="gap-2">
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
