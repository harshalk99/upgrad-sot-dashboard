import type { Metadata } from 'next';
import { Geist, Geist_Mono, JetBrains_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { ReactQueryProvider } from '@/components/providers/react-query-provider';
import './globals.css';

// Kubota-inspired typography pairing: Inter for UI + JetBrains Mono for numeric KPIs.
// Using create-next-app default Geist as Inter substitute (similar humanist sans).
const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin']
});

const geistMono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin']
});

const numericMono = JetBrains_Mono({
  variable: '--font-numeric',
  subsets: ['latin'],
  weight: ['400', '500', '600']
});

export const metadata: Metadata = {
  title: 'UGSOT Voice Agent Ops',
  description: 'Operations dashboard for the Swati AI voice agent campaign (Predixion × UGSOT).'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${numericMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-full flex flex-col">
        <ReactQueryProvider>
          {children}
          <Toaster richColors closeButton />
        </ReactQueryProvider>
      </body>
    </html>
  );
}
