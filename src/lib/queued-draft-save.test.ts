import { describe, expect, it, vi } from 'vitest';
import { QueuedDraftSave } from './queued-draft-save';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('queued draft saves', () => {
  it('serializes changes made during a request and preserves the latest fields', async () => {
    const first = deferred();
    const second = deferred();
    const save = vi.fn().mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    const queue = new QueuedDraftSave(save);
    const a = queue.submit({ nights: 2, foodTier: 'mid' });
    const b = queue.submit({ nights: 12 });
    const c = queue.submit({ accomOverride: 0 });
    expect(save).toHaveBeenCalledTimes(1);
    expect(queue.state.patch).toEqual({ nights: 12, foodTier: 'mid', accomOverride: 0 });
    first.resolve();
    await a;
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toEqual({ nights: 12, accomOverride: 0 });
    expect(queue.state.patch).toEqual({ nights: 12, accomOverride: 0 });
    second.resolve();
    await Promise.all([b, c]);
    expect(queue.state).toEqual({ patch: {}, saving: false, error: null });
  });

  it('retains all unconfirmed changes on failure and retries the latest draft', async () => {
    const first = deferred();
    const save = vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValue(undefined);
    const queue = new QueuedDraftSave(save);
    const a = queue.submit({ nights: 2 }).catch(error => error.message);
    const b = queue.submit({ nights: 15, status: 'active' }).catch(error => error.message);
    first.reject(new Error('Rejected save'));
    expect(await Promise.all([a, b])).toEqual(['Rejected save', 'Rejected save']);
    expect(queue.state).toEqual({ patch: { nights: 15, status: 'active' }, saving: false, error: 'Rejected save' });
    await queue.retry();
    expect(save.mock.calls[1][0]).toEqual({ nights: 15, status: 'active' });
    expect(queue.state.patch).toEqual({});
  });

  it('discards a failed draft without an extra write and cannot discard an active request', async () => {
    const first = deferred();
    const save = vi.fn(() => first.promise);
    const queue = new QueuedDraftSave(save);
    const result = queue.submit({ foodTier: 'high' }).catch(() => undefined);
    queue.discard();
    expect(queue.state.patch).toEqual({ foodTier: 'high' });
    first.reject(new Error('Failed'));
    await result;
    queue.discard();
    expect(queue.state).toEqual({ patch: {}, saving: false, error: null });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('resolves edits changed back to the confirmed value without an unnecessary second write', async () => {
    const first = deferred();
    const save = vi.fn(() => first.promise);
    const queue = new QueuedDraftSave(save);
    const a = queue.submit({ nights: 2 });
    const b = queue.submit({ nights: 20 });
    const c = queue.submit({ nights: 2 });
    first.resolve();
    await Promise.all([a, b, c]);
    expect(save).toHaveBeenCalledTimes(1);
    expect(queue.state.patch).toEqual({});
  });
});
