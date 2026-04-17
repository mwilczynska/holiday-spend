import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Legacy PIN login has been removed. Use /login with the configured auth providers.' },
    { status: 410, headers: { 'X-Robots-Tag': 'noindex' } }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: 'Legacy PIN login has been removed. Use /login with the configured auth providers.' },
    { status: 410, headers: { 'X-Robots-Tag': 'noindex' } }
  );
}
