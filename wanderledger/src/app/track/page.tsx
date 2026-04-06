'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { EXPENSE_CATEGORIES } from '@/types';
import { Trash2, Edit, Eye, EyeOff, Upload, Tags, XCircle } from 'lucide-react';
import Link from 'next/link';

interface Expense {
  id: number;
  date: string;
  amount: number;
  currency: string;
  amountAud: number | null;
  category: string;
  subcategory: string | null;
  description: string | null;
  merchant: string | null;
  legId: number | null;
  source: string;
  loggedBy: string | null;
  isExcluded: number;
}

export default function TrackPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filterCat, setFilterCat] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState<Partial<Expense>>({});

  const fetchExpenses = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterCat !== 'all') params.set('cat', filterCat);
    if (filterSource !== 'all') params.set('source', filterSource);
    if (filterFrom) params.set('from', filterFrom);
    if (filterTo) params.set('to', filterTo);

    const res = await fetch(`/api/expenses?${params}`);
    const data = await res.json();
    setExpenses(data.data || []);
  }, [filterCat, filterSource, filterFrom, filterTo]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const handleToggleExclude = async (id: number) => {
    await fetch(`/api/expenses/${id}/exclude`, { method: 'PATCH' });
    fetchExpenses();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Permanently delete this expense?')) return;
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    fetchExpenses();
  };

  const handleEditSave = async () => {
    if (!editExpense) return;
    await fetch(`/api/expenses/${editExpense.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setEditExpense(null);
    fetchExpenses();
  };

  const openEdit = (exp: Expense) => {
    setEditExpense(exp);
    setEditForm({ ...exp });
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkAction = async (action: string, extra?: Record<string, unknown>) => {
    await fetch('/api/expenses/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds), action, ...extra }),
    });
    setSelectedIds(new Set());
    fetchExpenses();
  };

  const activeExpenses = expenses.filter(e => !e.isExcluded);
  const totalAud = activeExpenses.reduce((s, e) => s + (e.amountAud ?? e.amount), 0);

  const categoryLabel = (val: string) => EXPENSE_CATEGORIES.find(c => c.value === val)?.label ?? val;

  const handleDeleteAll = async () => {
    if (!confirm(`Delete ALL ${expenses.length} expenses? This cannot be undone.`)) return;
    await fetch('/api/expenses/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: expenses.map(e => e.id), action: 'delete' }),
    });
    fetchExpenses();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/track/add"><Button size="sm">Add</Button></Link>
          <Link href="/track/import"><Button size="sm" variant="outline"><Upload className="h-4 w-4 mr-1" />Import</Button></Link>
          <Link href="/track/tags"><Button size="sm" variant="outline"><Tags className="h-4 w-4 mr-1" />Tags</Button></Link>
          {expenses.length > 0 && (
            <Button size="sm" variant="destructive" onClick={handleDeleteAll}>
              <XCircle className="h-4 w-4 mr-1" />Delete All
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="wise_csv">Wise CSV</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" className="w-[140px] h-8 text-xs" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} placeholder="From" />
        <Input type="date" className="w-[140px] h-8 text-xs" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} placeholder="To" />
      </div>

      {/* Summary */}
      <div className="flex gap-4 text-sm">
        <span>{expenses.length} expenses</span>
        <span className="font-medium">${totalAud.toLocaleString('en-AU', { maximumFractionDigits: 0 })} AUD</span>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex gap-2 p-2 bg-muted rounded">
          <span className="text-sm">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => handleBulkAction('exclude')}>Exclude</Button>
          <Button size="sm" variant="outline" onClick={() => handleBulkAction('include')}>Include</Button>
          <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>Clear</Button>
        </div>
      )}

      {/* Expense list */}
      <div className="space-y-1">
        {expenses.length === 0 && (
          <p className="text-muted-foreground text-center py-12">No expenses yet.</p>
        )}
        {expenses.map((exp) => (
          <Card key={exp.id} className={exp.isExcluded ? 'opacity-50' : ''}>
            <CardContent className="p-3 flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedIds.has(exp.id)}
                onChange={() => toggleSelect(exp.id)}
                className="h-4 w-4"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium">
                    {exp.amount.toFixed(2)} {exp.currency}
                  </span>
                  {exp.amountAud && exp.currency !== 'AUD' && (
                    <span className="text-xs text-muted-foreground">(${exp.amountAud.toFixed(2)} AUD)</span>
                  )}
                  <Badge variant="outline" className="text-xs">{categoryLabel(exp.category)}</Badge>
                  {exp.source === 'wise_csv' && <Badge variant="secondary" className="text-xs">Wise</Badge>}
                  {exp.isExcluded ? <Badge variant="destructive" className="text-xs">Excluded</Badge> : null}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {exp.date} {exp.description && `— ${exp.description}`} {exp.merchant && `@ ${exp.merchant}`}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleExclude(exp.id)}>
                  {exp.isExcluded ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(exp)}>
                  <Edit className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(exp.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editExpense} onOpenChange={(open) => !open && setEditExpense(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Expense</DialogTitle></DialogHeader>
          {editForm && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Date</Label><Input type="date" className="h-8 text-xs" value={editForm.date || ''} onChange={(e) => setEditForm(p => ({ ...p, date: e.target.value }))} /></div>
                <div><Label className="text-xs">Amount</Label><Input type="number" className="h-8 text-xs" value={editForm.amount || ''} onChange={(e) => setEditForm(p => ({ ...p, amount: parseFloat(e.target.value) }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Currency</Label><Input className="h-8 text-xs" value={editForm.currency || ''} onChange={(e) => setEditForm(p => ({ ...p, currency: e.target.value }))} /></div>
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select value={editForm.category || ''} onValueChange={(v) => setEditForm(p => ({ ...p, category: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-xs">Description</Label><Input className="h-8 text-xs" value={editForm.description || ''} onChange={(e) => setEditForm(p => ({ ...p, description: e.target.value }))} /></div>
              <div><Label className="text-xs">Merchant</Label><Input className="h-8 text-xs" value={editForm.merchant || ''} onChange={(e) => setEditForm(p => ({ ...p, merchant: e.target.value }))} /></div>
              <div><Label className="text-xs">Subcategory</Label><Input className="h-8 text-xs" value={editForm.subcategory || ''} onChange={(e) => setEditForm(p => ({ ...p, subcategory: e.target.value }))} /></div>
              <Button onClick={handleEditSave} className="w-full">Save Changes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
