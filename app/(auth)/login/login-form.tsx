'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

type Props = {
  redirectTo?: string;
  initialError?: string;
};

const ROLE_LANDINGS: Record<string, string> = {
  client: '/dashboard',
  admin: '/admin',
  super_admin: '/super'
};

export function LoginForm({ redirectTo, initialError }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    initialError === 'access_pending'
      ? 'Access pending. Contact your administrator to assign a role.'
      : null
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError || !signInData.user) {
      setError(signInError?.message ?? 'Sign in failed');
      setLoading(false);
      return;
    }

    // Resolve role to pick landing page
    const { data: roleRow } = await supabase
      .from('dashboard_user_roles')
      .select('role')
      .eq('user_id', signInData.user.id)
      .single();

    if (!roleRow) {
      await supabase.auth.signOut();
      setError('Access pending. Contact your administrator to assign a role.');
      setLoading(false);
      return;
    }

    const target = redirectTo && redirectTo.startsWith('/')
      ? redirectTo
      : ROLE_LANDINGS[roleRow.role] ?? '/dashboard';

    toast.success(`Welcome back · ${roleRow.role}`);
    router.replace(target);
    router.refresh();
  }

  return (
    <Card className="border-border/80">
      <CardContent className="pt-6">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
