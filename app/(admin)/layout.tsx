// Admin (Predixion ops) shell — Phase 2: Sidebar + Header via AppShell.
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/getUser';
import { roleHasAtLeast } from '@/lib/auth/userRole';
import { AppShell } from '@/components/layout/AppShell';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!roleHasAtLeast(user.role, 'admin')) redirect('/dashboard');
  return <AppShell role={user.role}>{children}</AppShell>;
}
