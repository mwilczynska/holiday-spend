import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { pin } = await request.json();
  const appSecret = process.env.APP_SECRET;

  if (!appSecret || pin !== appSecret) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('wanderledger-auth', appSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });

  return response;
}
