'use client';

import { useEffect, useRef, useState } from 'react';
import { QueuedDraftSave, type DraftPatch, type DraftSaveState } from './queued-draft-save';

export function useQueuedDraftSave(save: (patch: DraftPatch) => Promise<void>, onDirtyChange: (dirty: boolean) => void) {
  const callbacks = useRef({ save, onDirtyChange });
  callbacks.current = { save, onDirtyChange };
  const queueRef = useRef<QueuedDraftSave | null>(null);
  if (!queueRef.current) queueRef.current = new QueuedDraftSave(patch => callbacks.current.save(patch));
  const queue = queueRef.current;
  const [state, setState] = useState<DraftSaveState>(() => queue.state);
  useEffect(() => {
    const unsubscribe = queue.subscribe(next => {
      setState(next);
      callbacks.current.onDirtyChange(next.saving || Object.keys(next.patch).length > 0);
    });
    return () => {
      unsubscribe();
      callbacks.current.onDirtyChange(false);
    };
  }, [queue]);
  return { state, queue };
}
