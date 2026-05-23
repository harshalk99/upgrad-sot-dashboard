// /login — server component that renders the form, with a tiny client island
// for the actual sign-in call.
import { LoginForm } from './login-form';
import { PredixionLogo } from '@/components/branding/PredixionLogo';

export const metadata = { title: 'Sign in · UGSOT Voice Agent Ops' };

type SearchParams = Promise<{ redirectTo?: string; error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  // NOTE (Next 16): searchParams is async.
  const { redirectTo, error } = await searchParams;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <PredixionLogo variant="black" size={80} withWordmark />
        <div className="mt-3 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          UGSOT Voice Agent Ops
        </div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use your campaign credentials.
        </p>
      </div>

      <LoginForm redirectTo={redirectTo} initialError={error} />

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Test users: <code className="font-mono">client@ugsot.test</code> /{' '}
        <code className="font-mono">admin@predixion.test</code> /{' '}
        <code className="font-mono">superadmin@predixion.test</code>
        <br />
        Password: <code className="font-mono">UGSOT-temp-2026!</code>
      </p>
    </div>
  );
}
