export type DeviceCategory = 'mobile' | 'desktop' | 'unknown';

/**
 * Device category for an analytics event, from request headers only.
 * Sec-CH-UA-Mobile is sent by Chromium browsers alone; Safari and Firefox never send it, so
 * without the user-agent fallback every iPhone was recorded as desktop. iPadOS reports a desktop
 * user agent and is counted as desktop.
 */
export function deviceCategory(headers: Headers): DeviceCategory {
  const hint = headers.get('sec-ch-ua-mobile');
  if (hint === '?1') return 'mobile';
  if (hint === '?0') return 'desktop';
  const agent = headers.get('user-agent');
  if (!agent) return 'unknown';
  return /Mobi|Android|iPhone|iPod/i.test(agent) ? 'mobile' : 'desktop';
}
