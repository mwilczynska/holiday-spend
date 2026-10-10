import fs from 'fs';
import { requireCurrentUserId } from '@/lib/auth';
import { handleError } from '@/lib/api-helpers';
import { cityImageFilePath, getCityImageViews, getCityImageRow } from '@/lib/city-image-service';

export const dynamic = 'force-dynamic';

const CONTENT_TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

/**
 * Serves a stored city photo. It lives outside /api so that image loads are not counted as data
 * reads; the versioned URL (?v=fetchedAt) lets the browser cache it indefinitely.
 */
export async function GET(request: Request, { params }: { params: { cityId: string } }) {
  try {
    await requireCurrentUserId();
    const cityId = decodeURIComponent(params.cityId);
    // Only serve a photo the pages would currently show (current name, country and version).
    if (!getCityImageViews([cityId])[cityId]) return new Response('Not found', { status: 404 });
    const row = getCityImageRow(cityId);
    const small = new URL(request.url).searchParams.get('size') === 'small';
    const fileName = small ? row?.smallFile : row?.largeFile;
    if (!fileName) return new Response('Not found', { status: 404 });
    const extension = fileName.split('.').pop() ?? '';
    let bytes: Buffer;
    try {
      bytes = fs.readFileSync(cityImageFilePath(fileName));
    } catch {
      return new Response('Not found', { status: 404 });
    }
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
        'Cache-Control': 'private, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
