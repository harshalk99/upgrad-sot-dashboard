// Minimal layout for unauthenticated routes (login).
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="grid min-h-dvh place-items-center px-4">{children}</main>;
}
