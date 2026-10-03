'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface TagOption { id: number; name: string }

export function ExpenseTagsDialog({ expenseId, onClose }: { expenseId: number; onClose: () => void }) {
  const [tags, setTags] = useState<TagOption[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const requestState = useRef({ sequence: 0 });
  const endpoint = `/api/expenses/${expenseId}/tags`;

  const load = useCallback(async () => {
    const read = ++requestState.current.sequence;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(endpoint);
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || `Could not load tags (HTTP ${response.status}).`);
      if (!Array.isArray(result?.data?.tags) || !Array.isArray(result?.data?.tagIds)) throw new Error('The server returned unreadable tags. Try again.');
      if (read !== requestState.current.sequence) return;
      setTags(result.data.tags);
      setSelected(result.data.tagIds);
      setLoaded(true);
    } catch (err) {
      if (read === requestState.current.sequence) setError(err instanceof Error ? err.message : 'Could not load tags. Check your connection and try again.');
    } finally {
      if (read === requestState.current.sequence) setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    const state = requestState.current;
    void load();
    return () => { state.sequence++; };
  }, [load]);

  const save = async () => {
    if (submitting.current || !loaded) return;
    submitting.current = true;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tagIds: selected }) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || `Could not save tags (HTTP ${response.status}). Try again.`);
      if (!Array.isArray(result?.data?.tagIds)) throw new Error('The server returned an unreadable response. Reload before retrying.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save tags. Check your connection and try again.');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Expense tags</DialogTitle>
        <DialogDescription>Select tags for this expense. Uncheck a tag to remove it.</DialogDescription>
      </DialogHeader>
      {loading ? <p role="status">Loading tags...</p> : loaded && <div className="max-h-64 overflow-y-auto space-y-3">
        {tags.length ? tags.map(tag => <label key={tag.id} className="flex items-center gap-3 break-words">
          <input type="checkbox" checked={selected.includes(tag.id)} disabled={saving} onChange={event => setSelected(current => event.target.checked ? [...current, tag.id] : current.filter(id => id !== tag.id))} />
          {tag.name}
        </label>) : <p>No tags yet. <Link className="underline" href="/track/tags">Create a tag</Link> to use it here.</p>}
      </div>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!loaded && !loading && <Button variant="outline" onClick={() => void load()}>Retry loading tags</Button>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
        <Button disabled={loading || !loaded || saving} onClick={() => void save()}>{saving ? 'Saving...' : 'Save tags'}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
