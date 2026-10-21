import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth';
import { sqlite } from '@/db';
import { accountAnalyticsId, analyticsEnabled } from '@/lib/analytics/service';
import { handleError } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const user = (await getAuthSession())?.user;
    const enabled = user?.id ? analyticsEnabled(user.id) : !request.headers.get('cookie')?.split(';').some(c => c.trim() === 'hs_analytics_disabled=1');
    return NextResponse.json({ data: { enabled, identity: user?.id ? accountAnalyticsId(user.id) : 'anonymous' } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) { return handleError(err); }
}
export async function PUT(request: Request) {
  try {
    const { enabled } = z.object({ enabled: z.boolean() }).strict().parse(await request.json());
    const user = (await getAuthSession())?.user;
    if (user?.id) {
      sqlite.transaction(() => {
        sqlite.prepare('INSERT INTO analytics_preferences(user_id,enabled,changed_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled,changed_at=excluded.changed_at')
          .run(user.id, Number(enabled), new Date().toISOString());
        if (!enabled) sqlite.prepare("DELETE FROM analytics_outbox WHERE user_id=? AND purpose='behavior'").run(user.id);
      })();
    }
    const response = NextResponse.json({ data: { enabled } });
    response.cookies.set('hs_analytics_disabled', enabled ? '' : '1', { path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: enabled ? 0 : 365 * 86400 });
    return response;
  } catch (err) { return handleError(err); }
}
