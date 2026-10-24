import { describe, expect, it } from 'vitest';
import { SERVER_LLM_KEY_NAMES, validateProductionConfig } from '../../scripts/lib/production-config.mjs';
import { getLlmProviderServerApiKeyNames } from '@/lib/llm-provider-registry';

const valid = {
  NEXTAUTH_SECRET: 'test-only-secret-with-more-than-32-characters',
  APP_URL: 'https://spend.example.com', NEXTAUTH_URL: 'https://spend.example.com',
  AUTH_ADMIN_EMAILS: 'owner@example.com',
  ENABLE_EMAIL_PASSWORD: 'true', RESEND_API_KEY: 'test-fixture-only', MAIL_FROM: 'App <noreply@auth.example.com>',
  HOLIDAY_SPEND_DB_PATH: '/app/data/travel.db', HOLIDAY_SPEND_TRUST_PROXY: 'true',
};
describe('production startup configuration', () => {
  it('accepts explicit private native-auth configuration', () => expect(() => validateProductionConfig(valid)).not.toThrow());
  it.each([
    { NEXTAUTH_SECRET: '' }, { AUTH_ADMIN_EMAILS: '' }, { AUTH_ADMIN_EMAILS: 'not-an-email' },
    { NEXTAUTH_URL: 'https://wrong.example.com' }, { APP_URL: 'http://spend.example.com' },
    { RESEND_API_KEY: '' }, { MAIL_FROM: '' }, { HOLIDAY_SPEND_DB_PATH: '' },
    { HOLIDAY_SPEND_TRUST_PROXY: 'false' }, { AUTH_DEV_PIN: '12345' },
    { OPENAI_API_KEY: 'server-key-fixture' }, { ANTHROPIC_API_KEY: 'server-key-fixture' }, { GEMINI_API_KEY: 'server-key-fixture' },
  ])('fails closed for incomplete or unsafe configuration: %j', invalid => {
    expect(() => validateProductionConfig({ ...valid, ...invalid })).toThrow();
  });
  it('refuses every provider registry server key', () => {
    expect([...SERVER_LLM_KEY_NAMES].sort()).toEqual(getLlmProviderServerApiKeyNames().sort());
    for (const key of getLlmProviderServerApiKeyNames()) {
      expect(() => validateProductionConfig({ ...valid, [key]: 'server-key-fixture' })).toThrow(key);
    }
  });
});
