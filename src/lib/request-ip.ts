type HeaderBag =
  | Headers
  | Record<string, string | string[] | undefined>
  | undefined;

type RequestLike = Request | { headers?: HeaderBag; ip?: string | null } | null | undefined;

function readHeader(headers: HeaderBag, name: string): string | null {
  if (!headers) {
    return null;
  }

  if (headers instanceof Headers) {
    return headers.get(name);
  }

  const exact = headers[name];
  const lower = headers[name.toLowerCase()];
  const value = exact ?? lower;

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export function getRequestIp(request: RequestLike): string | null {
  if (!request) {
    return null;
  }

  const forwardedFor = readHeader(request.headers, 'x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor
      .split(',')
      .map((value) => value.trim())
      .find(Boolean);

    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = readHeader(request.headers, 'x-real-ip');
  if (realIp?.trim()) {
    return realIp.trim();
  }

  const fallbackIp = 'ip' in request ? request.ip : null;
  return fallbackIp?.trim() || null;
}
