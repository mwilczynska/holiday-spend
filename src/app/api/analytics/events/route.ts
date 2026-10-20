import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { isEmailAllowed, isLibraryAdmin } from '@/lib/auth-policy';
import { browserBatchSchema } from '@/lib/analytics/catalogue';
import { accountAnalyticsId, analyticsEnabled, enqueueEvent, ensureAnalyticsWorker, makeEvent } from '@/lib/analytics/service';
import { checkRateLimit } from '@/lib/rate-limit';
import { getRequestIp } from '@/lib/request-ip';
import { createHash } from 'node:crypto';
import { isCrossOriginWrite } from '@/lib/request-origin';

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || isCrossOriginWrite(request)) return NextResponse.json({ error: 'Same-origin collection required.' }, { status: 403 });
  if (Number(request.headers.get('content-length') || 0) > 65536) return new Response(null, { status: 413 });
  const limitKey = createHash('sha256').update('analytics:' + (getRequestIp(request) || 'unknown')).digest('hex');
  const limit = await checkRateLimit('analytics:' + limitKey, { max: 120, windowSeconds: 60 });
  if (!limit.allowed) return new Response(null, { status: 429 });
  const text = await request.text();
  if (Buffer.byteLength(text) > 65536) return new Response(null, { status: 413 });
  let value: unknown;
  try { value = JSON.parse(text); } catch { return new Response(null, { status: 400 }); }
  const batch = browserBatchSchema.safeParse(value);
  if (!batch.success) return NextResponse.json({ error: 'Invalid analytics batch.' }, { status: 400 });
  const user = (await getAuthSession())?.user;
  const userId = user?.id && isEmailAllowed(user.email) ? user.id : undefined;
  const disabled = request.headers.get('cookie')?.split(';').some(c => c.trim() === 'hs_analytics_disabled=1');
  if ((!userId && disabled) || (userId && !analyticsEnabled(userId))) return new Response(null, { status: 204 });
  try {
    for (const item of batch.data.events) {
      const now = Date.now();
      if (Math.abs(now - Date.parse(item.occurredAt)) > 86400_000) continue;
      enqueueEvent(makeEvent(item.name, item.properties as never, { ...item,
        source: 'browser', accountId: userId ? accountAnalyticsId(userId) : null,
        administrator: Boolean(userId && isLibraryAdmin(user?.email)),
        device: request.headers.get('sec-ch-ua-mobile') === '?1' ? 'mobile' : 'desktop',
      }), userId);
    }
    ensureAnalyticsWorker();
    return new Response(null, { status: 204 });
  } catch { return new Response(null, { status: 503 }); }
}
