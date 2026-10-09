'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { InlineLoadingState, PageLoadingState } from '@/components/ui/loading-state';
import { Plus, Trash2, Edit, Tags as TagsIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

interface Tag {
  id: number;
  name: string;
  color: string | null;
  expenseCount: number;
  totalAud: number;
}

interface TagExpense {
  id: number;
  date: string;
  amount: number;
  currency: string;
  amountAud: number | null;
  category: string;
  description: string | null;
  isExcluded: number | null;
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [tagExpenses, setTagExpenses] = useState<TagExpense[]>([]);
  const [tagTotal, setTagTotal] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [editTag, setEditTag] = useState<Tag | null>(null);
  const [loading, setLoading] = useState(true);
  const [tagLoading, setTagLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tagReadError, setTagReadError] = useState<string | null>(null);
  const submitting = useRef(false);
  const tagReadSequence = useRef(0);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/tags');
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Could not load tags (HTTP ${res.status}).`);
      if (!Array.isArray(data?.data)) throw new Error('The server returned unreadable tags. Try again.');
      setTags(data.data);
      setSelectedTag(current => current ? data.data.find((tag: Tag) => tag.id === current.id) ?? null : null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load tags. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  const selectTag = async (tag: Tag) => {
    const read = ++tagReadSequence.current;
    setSelectedTag(tag);
    setTagLoading(true);
    setTagReadError(null);
    setTagExpenses([]);
    setTagTotal(0);
    try {
      const res = await fetch(`/api/tags/${tag.id}/expenses`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Could not load tagged expenses (HTTP ${res.status}).`);
      if (!Array.isArray(data?.data?.expenses)) throw new Error('The server returned unreadable tagged expenses. Try again.');
      if (read !== tagReadSequence.current) return;
      setTagExpenses(data.data.expenses);
      setTagTotal(data.data.totalAud);
    } catch (err) {
      if (read === tagReadSequence.current) setTagReadError(err instanceof Error ? err.message : 'Could not load tagged expenses. Check your connection and try again.');
    } finally {
      if (read === tagReadSequence.current) setTagLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await mutateTag('/api/tags', 'POST', { name: newName.trim(), color: newColor }, () => {
      setAddOpen(false);
      setNewName('');
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this tag? It will be removed from all expenses.')) return;
    await mutateTag(`/api/tags/${id}`, 'DELETE', undefined, () => {
      if (selectedTag?.id === id) {
        tagReadSequence.current += 1;
        setSelectedTag(null);
        setTagExpenses([]);
      }
    });
  };

  const handleEditSave = async () => {
    if (!editTag?.name.trim()) return;
    await mutateTag(`/api/tags/${editTag.id}`, 'PUT', { name: editTag.name.trim(), color: editTag.color }, () => setEditTag(null));
  };

  const mutateTag = async (url: string, method: string, body?: Record<string, unknown>, onSuccess?: () => void) => {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setMutationError(null);
    try {
      const response = await fetch(url, { method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `Could not update tags (HTTP ${response.status}). Try again.`);
      if (!data?.data) throw new Error('The server returned an unreadable response. Reload before retrying.');
      onSuccess?.();
      await fetchTags();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Could not update tags. Check your connection and try again.');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  if (loading && tags.length === 0 && !loadError) {
    return (
      <PageLoadingState
        title="Loading tags"
        description="Fetching your saved tags and their expense totals."
        cardCount={2}
        rowCount={5}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={TagsIcon}
        title="Tags"
        description="Group expenses across categories, such as flights or splurge meals, and see their AUD totals."
        actions={(
        <Dialog open={addOpen} onOpenChange={open => { if (!saving) { setAddOpen(open); setMutationError(null); } }}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={saving}><Plus className="h-4 w-4 mr-1" />New Tag</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Tag</DialogTitle>
              <DialogDescription className="sr-only">
                Create a tag you can apply to expenses and filter by.
              </DialogDescription></DialogHeader>
            <fieldset disabled={saving} className="space-y-4">
              {mutationError && <p role="alert" className="text-sm text-destructive">{mutationError}</p>}
              <div><Label htmlFor="tag-create-name">Name</Label><Input id="tag-create-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. flights, splurge-meals" /></div>
              <div><Label htmlFor="tag-create-color">Color</Label><Input id="tag-create-color" type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-10 w-20" /></div>
              <Button onClick={handleAdd} className="w-full" disabled={saving || !newName.trim()}>{saving ? 'Creating…' : 'Create Tag'}</Button>
            </fieldset>
          </DialogContent>
        </Dialog>
        )}
      />

      {!addOpen && !editTag && mutationError && <p role="alert" className="text-sm text-destructive">{mutationError}</p>}
      {loadError && <div><p role="alert" className="text-sm text-destructive">{loadError}</p><Button size="sm" variant="outline" onClick={() => void fetchTags()}>Retry loading tags</Button></div>}

      <div className="grid lg:grid-cols-[300px_1fr] gap-6">
        {/* Tag list */}
        <div className="space-y-2">
          {tags.length === 0 && !loadError && <p className="rounded-2xl border-2 border-dashed border-slate-300 py-8 text-center text-muted-foreground">No tags yet.</p>}
          {tags.map((tag) => (
            <Card
              key={tag.id}
              className={`transition-colors ${selectedTag?.id === tag.id ? 'border-blue-300 bg-info-soft' : 'hover:bg-secondary'}`}
            >
              <CardContent className="p-3 flex items-center gap-2">
                <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-label={`View ${tag.name} expenses`} onClick={() => void selectTag(tag)}>
                {tag.color && (
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                )}
                <span className="font-medium flex-1">{tag.name}</span>
                <span className="text-xs text-muted-foreground">{tag.expenseCount} expenses</span>
                <span className="text-sm font-medium">${tag.totalAud.toFixed(0)}</span>
                </button>
                <Button aria-label={`Edit ${tag.name} tag`} disabled={saving} variant="ghost" size="icon" className="h-8 w-8 text-slate-600" onClick={() => { setMutationError(null); setEditTag(tag); }}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button aria-label={`Delete ${tag.name} tag`} disabled={saving} variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-destructive" onClick={() => void handleDelete(tag.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tag expenses */}
        <div>
          {selectedTag ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {selectedTag.color && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedTag.color }} />}
                  {selectedTag.name}
                  <Badge variant="secondary">{tagLoading ? 'Loading total…' : tagReadError ? 'Total unavailable' : `$${tagTotal.toFixed(0)} AUD`}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-xs text-muted-foreground">AUD totals use included expenses with an available AUD value.</p>
                {tagLoading ? (
                  <InlineLoadingState
                    title={`Loading expenses for ${selectedTag.name}`}
                    detail="Gathering the tagged transactions and their total spend."
                  />
                ) : tagReadError ? <div><p role="alert" className="text-sm text-destructive">{tagReadError}</p><Button size="sm" variant="outline" onClick={() => void selectTag(selectedTag)}>Retry tagged expenses</Button></div> : tagExpenses.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No expenses with this tag.</p>
                ) : (
                  <div className="space-y-1">
                    {tagExpenses.map((exp) => (
                      <div key={exp.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                        <div>
                          <span className="text-muted-foreground">{exp.date}</span>
                          {exp.description && <span className="ml-2">{exp.description}</span>}
                          {exp.isExcluded ? <Badge variant="secondary" className="ml-2">Excluded</Badge> : null}
                          {exp.currency !== 'AUD' && exp.amountAud == null ? <Badge variant="outline" className="ml-2">No AUD conversion</Badge> : null}
                        </div>
                        <span className="font-medium">{exp.amount.toFixed(2)} {exp.currency}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <p className="rounded-2xl border-2 border-dashed border-slate-300 py-12 text-center text-muted-foreground">Select a tag to see its expenses.</p>
          )}
        </div>
      </div>

      {/* Edit tag dialog */}
      <Dialog open={!!editTag} onOpenChange={(open) => { if (!open && !saving) setEditTag(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription className="sr-only">
              Rename this tag or change its colour.
            </DialogDescription></DialogHeader>
          {editTag && (
            <fieldset disabled={saving} className="space-y-4">
              {mutationError && <p role="alert" className="text-sm text-destructive">{mutationError}</p>}
              <div><Label htmlFor="tag-edit-name">Name</Label><Input id="tag-edit-name" value={editTag.name} onChange={(e) => setEditTag({ ...editTag, name: e.target.value })} /></div>
              <div><Label htmlFor="tag-edit-color">Color</Label><Input id="tag-edit-color" type="color" value={editTag.color || '#3b82f6'} onChange={(e) => setEditTag({ ...editTag, color: e.target.value })} className="h-10 w-20" /></div>
              <Button disabled={saving || !editTag.name.trim()} onClick={handleEditSave} className="w-full">{saving ? 'Saving…' : 'Save'}</Button>
            </fieldset>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
