import { describe, expect, it } from 'vitest';
import { validateProductionConfig } from '../../scripts/lib/production-config.mjs';

const valid = {
  NEXTAUTH_SECRET: 'test-only-secret-with-more-than-32-characters',
  APP_URL: 'https://spend.example.com', NEXTAUTH_URL: 'https://spend.example.com',
  AUTH_ALLOWED_EMAILS: 'owner@example.com,guest@example.com', AUTH_ADMIN_EMAILS: 'owner@example.com',
  ENABLE_EMAIL_PASSWORD: 'true', RESEND_API_KEY: 'test-fixture-only', MAIL_FROM: 'App <noreply@auth.example.com>',
  HOLIDAY_SPEND_DB_PATH: '/app/data/travel.db', HOLIDAY_SPEND_TRUST_PROXY: 'true',
};
describe('production startup configuration', () => {
  it('accepts explicit private native-auth configuration', () => expect(() => validateProductionConfig(valid)).not.toThrow());
  it.each([
    { NEXTAUTH_SECRET: '' }, { AUTH_ALLOWED_EMAILS: '' }, { AUTH_ADMIN_EMAILS: 'stranger@example.com' },
    { NEXTAUTH_URL: 'https://wrong.example.com' }, { APP_URL: 'http://spend.example.com' },
    { RESEND_API_KEY: '' }, { MAIL_FROM: '' }, { HOLIDAY_SPEND_DB_PATH: '' },
    { HOLIDAY_SPEND_TRUST_PROXY: 'false' }, { AUTH_DEV_PIN: '12345' },
  ])('fails closed for incomplete or unsafe configuration: %j', invalid => {
    expect(() => validateProductionConfig({ ...valid, ...invalid })).toThrow();
  });
});
