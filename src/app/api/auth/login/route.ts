import { instrumentRoute } from '@/lib/analytics/route';
import { NextResponse } from 'next/server';

async function handleGET() {
  return NextResponse.json(
    { error: 'Legacy PIN login has been removed. Use /login with the configured auth providers.' },
    { status: 410, headers: { 'X-Robots-Tag': 'noindex' } }
  );
}

async function handlePOST() {
  return NextResponse.json(
    { error: 'Legacy PIN login has been removed. Use /login with the configured auth providers.' },
    { status: 410, headers: { 'X-Robots-Tag': 'noindex' } }
  );
}

export const GET = instrumentRoute(handleGET, '/api/auth/login', 'GET');
export const POST = instrumentRoute(handlePOST, '/api/auth/login', 'POST');
