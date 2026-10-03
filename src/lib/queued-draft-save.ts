export type DraftPatch = Record<string, unknown>;
export interface DraftSaveState {
  patch: DraftPatch;
  saving: boolean;
  error: string | null;
}

/** Serialize autosaves and keep changes made while an older request is pending. */
export class QueuedDraftSave {
  private patch: DraftPatch = {};
  private revision = 0;
  private saving = false;
  private error: string | null = null;
  private listener?: (state: DraftSaveState) => void;
  private waiters: Array<{ revision: number; resolve: () => void; reject: (error: Error) => void }> = [];

  constructor(private save: (patch: DraftPatch) => Promise<void>) {}

  get state(): DraftSaveState {
    return { patch: { ...this.patch }, saving: this.saving, error: this.error };
  }

  subscribe(listener: (state: DraftSaveState) => void) {
    this.listener = listener;
    listener(this.state);
    return () => { this.listener = undefined; };
  }

  private publish() { this.listener?.(this.state); }

  submit(patch: DraftPatch): Promise<void> {
    this.patch = { ...this.patch, ...patch };
    this.revision += 1;
    this.error = null;
    const result = new Promise<void>((resolve, reject) => {
      this.waiters.push({ revision: this.revision, resolve, reject });
    });
    this.publish();
    void this.drain();
    return result;
  }

  retry() { return this.submit({}); }

  discard() {
    if (this.saving) return;
    this.patch = {};
    this.error = null;
    this.publish();
  }

  private async drain() {
    if (this.saving) return;
    this.saving = true;
    this.publish();
    while (Object.keys(this.patch).length > 0) {
      const sent = { ...this.patch };
      const revision = this.revision;
      try {
        await this.save(sent);
      } catch (error) {
        const failure = error instanceof Error ? error : new Error('Could not save this leg. Check your connection and retry.');
        this.error = failure.message;
        this.saving = false;
        this.waiters.splice(0).forEach(waiter => waiter.reject(failure));
        this.publish();
        return;
      }
      // Only remove fields whose latest value was confirmed by this request.
      for (const field of Object.keys(sent)) {
        if (Object.is(this.patch[field], sent[field])) delete this.patch[field];
      }
      const completed = this.waiters.filter(waiter => waiter.revision <= revision);
      this.waiters = this.waiters.filter(waiter => waiter.revision > revision);
      completed.forEach(waiter => waiter.resolve());
      this.publish();
    }
    this.saving = false;
    this.waiters.splice(0).forEach(waiter => waiter.resolve());
    this.publish();
  }
}
