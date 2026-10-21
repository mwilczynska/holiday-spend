import { describe, expect, it, vi } from 'vitest';
vi.mock('@/db', () => ({
  sqlite: { prepare: () => ({ all: () => [{ id: 'owner', email: 'owner@example.com' }, { id: 'guest', email: 'guest@example.com' }, { id: 'legacy', email: null }] }) },
}));
vi.mock('./service', async () => {
  const { createHash } = await import('node:crypto');
  return { accountAnalyticsId: (id: string) => createHash('sha256').update('holiday-spend:analytics:' + id).digest('hex') };
});
import { accountDirectory } from './accounts';
import { createHash } from 'node:crypto';

const hash = (id: string) => createHash('sha256').update('holiday-spend:analytics:' + id).digest('hex');

describe('analytics account directory', () => {
  it('maps each pseudonymous account ID to its email and skips accounts without one', () => {
    expect(accountDirectory()).toEqual({ [hash('owner')]: 'owner@example.com', [hash('guest')]: 'guest@example.com' });
  });
});
