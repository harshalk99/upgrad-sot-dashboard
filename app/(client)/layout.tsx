// Client (UGSOT) shell — Phase 2: Sidebar + Header via AppShell.
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/getUser';
import { AppShell } from '@/components/layout/AppShell';

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <AppShell role={user.role}>{children}</AppShell>;
}
