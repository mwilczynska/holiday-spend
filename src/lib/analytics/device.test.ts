import { describe, expect, it } from 'vitest';
import { deviceCategory } from './device';

const headers = (values: Record<string, string>) => new Headers(values);
const iphoneSafari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const androidFirefox = 'Mozilla/5.0 (Android 15; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0';
const macSafari = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

describe('analytics device category', () => {
  it('uses the client hint when Chromium sends one', () => {
    expect(deviceCategory(headers({ 'sec-ch-ua-mobile': '?1', 'user-agent': macSafari }))).toBe('mobile');
    expect(deviceCategory(headers({ 'sec-ch-ua-mobile': '?0', 'user-agent': iphoneSafari }))).toBe('desktop');
  });
  it('falls back to the user agent for Safari and Firefox, which send no hint', () => {
    expect(deviceCategory(headers({ 'user-agent': iphoneSafari }))).toBe('mobile');
    expect(deviceCategory(headers({ 'user-agent': androidFirefox }))).toBe('mobile');
    expect(deviceCategory(headers({ 'user-agent': macSafari }))).toBe('desktop');
  });
  it('reports unknown when there is nothing to go on', () => {
    expect(deviceCategory(headers({}))).toBe('unknown');
  });
});
