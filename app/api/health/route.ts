// Public health probe — used by Vercel and middleware exclusion list.
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok', ts: new Date().toISOString() });
}
