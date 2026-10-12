import { sqlite } from '@/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  try {
    if (!sqlite.prepare('SELECT 1 FROM cities LIMIT 1').get()) throw new Error();
    return NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
