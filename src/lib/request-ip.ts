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

  // The public proxy must overwrite X-Real-IP. Client-supplied forwarded lists
  // are not evidence of an address, even when a proxy appends its own address.
  if (process.env.HOLIDAY_SPEND_TRUST_PROXY !== 'true') {
    return ('ip' in request ? request.ip : null)?.trim() || null;
  }
  return readHeader(request.headers, 'x-real-ip')?.trim() || null;
}
