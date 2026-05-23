// Root `/` — redirect to the right landing per role, or login.
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/getUser';
import { defaultLandingForRole } from '@/lib/auth/userRole';

export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  redirect(defaultLandingForRole(user.role));
}
