'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit } from 'lucide-react';

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

  const fetchTags = useCallback(async () => {
    const res = await fetch('/api/tags');
    const data = await res.json();
    setTags(data.data || []);
  }, []);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  const selectTag = async (tag: Tag) => {
    setSelectedTag(tag);
    const res = await fetch(`/api/tags/${tag.id}/expenses`);
    const data = await res.json();
    setTagExpenses(data.data?.expenses || []);
    setTagTotal(data.data?.totalAud || 0);
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    });
    setAddOpen(false);
    setNewName('');
    fetchTags();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this tag? It will be removed from all expenses.')) return;
    await fetch(`/api/tags/${id}`, { method: 'DELETE' });
    if (selectedTag?.id === id) {
      setSelectedTag(null);
      setTagExpenses([]);
    }
    fetchTags();
  };

  const handleEditSave = async () => {
    if (!editTag) return;
    await fetch(`/api/tags/${editTag.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editTag.name, color: editTag.color }),
    });
    setEditTag(null);
    fetchTags();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tags</h1>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Tag</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Tag</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. flights, splurge-meals" /></div>
              <div><Label>Color</Label><Input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-10 w-20" /></div>
              <Button onClick={handleAdd} className="w-full" disabled={!newName.trim()}>Create Tag</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-6">
        {/* Tag list */}
        <div className="space-y-2">
          {tags.length === 0 && <p className="text-muted-foreground text-center py-8">No tags yet.</p>}
          {tags.map((tag) => (
            <Card
              key={tag.id}
              className={`cursor-pointer transition-colors ${selectedTag?.id === tag.id ? 'ring-2 ring-primary' : ''}`}
              onClick={() => selectTag(tag)}
            >
              <CardContent className="p-3 flex items-center gap-2">
                {tag.color && (
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                )}
                <span className="font-medium flex-1">{tag.name}</span>
                <span className="text-xs text-muted-foreground">{tag.expenseCount} expenses</span>
                <span className="text-sm font-medium">${tag.totalAud.toFixed(0)}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setEditTag(tag); }}>
                  <Edit className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(tag.id); }}>
                  <Trash2 className="h-3 w-3" />
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
                  <Badge variant="secondary">${tagTotal.toFixed(0)} AUD</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tagExpenses.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No expenses with this tag.</p>
                ) : (
                  <div className="space-y-1">
                    {tagExpenses.map((exp) => (
                      <div key={exp.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                        <div>
                          <span className="text-muted-foreground">{exp.date}</span>
                          {exp.description && <span className="ml-2">{exp.description}</span>}
                        </div>
                        <span className="font-medium">{exp.amount.toFixed(2)} {exp.currency}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground text-center py-12">Select a tag to see its expenses.</p>
          )}
        </div>
      </div>

      {/* Edit tag dialog */}
      <Dialog open={!!editTag} onOpenChange={(open) => !open && setEditTag(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Tag</DialogTitle></DialogHeader>
          {editTag && (
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={editTag.name} onChange={(e) => setEditTag({ ...editTag, name: e.target.value })} /></div>
              <div><Label>Color</Label><Input type="color" value={editTag.color || '#3b82f6'} onChange={(e) => setEditTag({ ...editTag, color: e.target.value })} className="h-10 w-20" /></div>
              <Button onClick={handleEditSave} className="w-full">Save</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
