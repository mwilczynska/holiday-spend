'use client';

import { Fragment, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getExpenseAudAmount } from '@/lib/expense-aud';
import { EXPENSE_CATEGORIES } from '@/types';
import { ChevronDown, ChevronUp, Edit, Eye, EyeOff, Tags, Trash2, Upload, XCircle } from 'lucide-react';

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
  source: string | null;
  loggedBy: string | null;
  isExcluded: number;
  cityId: string | null;
  cityName: string | null;
  countryId: string | null;
  countryName: string | null;
  assignmentStartDate: string | null;
  assignmentEndDate: string | null;
}

interface LegOption {
  id: number;
  cityName: string;
  countryName: string;
  startDate: string | null;
  endDate: string | null;
}

interface ExpenseEditForm {
  date: string;
  amount: string;
  currency: string;
  category: string;
  subcategory: string;
  description: string;
  merchant: string;
  legId: string;
}

const UNASSIGNED_LEG_VALUE = 'unassigned';

function formatLegRange(startDate: string | null, endDate: string | null) {
  if (startDate && endDate) return `${startDate} to ${endDate}`;
  if (startDate) return `From ${startDate}`;
  if (endDate) return `Until ${endDate}`;
  return 'Dates not set';
}

function displayText(value: string | null) {
  return value && value.trim() ? value : '-';
}

function formatSource(source: string | null) {
  if (source === 'wise_csv') return 'Wise CSV';
  if (source === 'manual') return 'Manual';
  return source || '-';
}

export default function TrackPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [legs, setLegs] = useState<LegOption[]>([]);
  const [filterCat, setFilterCat] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState<ExpenseEditForm | null>(null);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterCat !== 'all') params.set('cat', filterCat);
    if (filterSource !== 'all') params.set('source', filterSource);
    if (filterFrom) params.set('from', filterFrom);
    if (filterTo) params.set('to', filterTo);

    const [expensesRes, itineraryRes] = await Promise.all([
      fetch(`/api/expenses?${params}`),
      fetch('/api/itinerary'),
    ]);

    const expensesData = await expensesRes.json();
    const itineraryData = await itineraryRes.json();

    setExpenses(expensesData.data || []);
    setLegs(
      (itineraryData.data || []).map((leg: LegOption) => ({
        id: leg.id,
        cityName: leg.cityName,
        countryName: leg.countryName,
        startDate: leg.startDate,
        endDate: leg.endDate,
      }))
    );
  }, [filterCat, filterSource, filterFrom, filterTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleExclude = async (id: number) => {
    await fetch(`/api/expenses/${id}/exclude`, { method: 'PATCH' });
    fetchData();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Permanently delete this expense?')) return;
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleEditSave = async () => {
    if (!editExpense || !editForm) return;

    const amount = Number.parseFloat(editForm.amount);
    if (!editForm.date || !Number.isFinite(amount) || amount <= 0 || !editForm.currency || !editForm.category) {
      return;
    }

    await fetch(`/api/expenses/${editExpense.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: editForm.date,
        amount,
        currency: editForm.currency.trim().toUpperCase(),
        category: editForm.category,
        subcategory: editForm.subcategory.trim() || null,
        description: editForm.description.trim() || null,
        merchant: editForm.merchant.trim() || null,
        legId: editForm.legId === UNASSIGNED_LEG_VALUE ? null : Number.parseInt(editForm.legId, 10),
      }),
    });

    setEditExpense(null);
    setEditForm(null);
    fetchData();
  };

  const openEdit = (exp: Expense) => {
    setEditExpense(exp);
    setEditForm({
      date: exp.date,
      amount: String(exp.amount),
      currency: exp.currency,
      category: exp.category,
      subcategory: exp.subcategory || '',
      description: exp.description || '',
      merchant: exp.merchant || '',
      legId: exp.legId != null ? String(exp.legId) : UNASSIGNED_LEG_VALUE,
    });
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleExpanded = (id: number) => {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedIds(next);
  };

  const handleBulkAction = async (action: string, extra?: Record<string, unknown>) => {
    await fetch('/api/expenses/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds), action, ...extra }),
    });
    setSelectedIds(new Set());
    fetchData();
  };

  const handleDeleteAll = async () => {
    if (!confirm(`Delete ALL ${expenses.length} expenses? This cannot be undone.`)) return;
    await fetch('/api/expenses/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: expenses.map((expense) => expense.id), action: 'delete' }),
    });
    fetchData();
  };

  const activeExpenses = expenses.filter((expense) => !expense.isExcluded);
  const totalAud = activeExpenses.reduce((sum, expense) => sum + getExpenseAudAmount(expense), 0);

  const categoryLabel = (value: string) => EXPENSE_CATEGORIES.find((category) => category.value === value)?.label ?? value;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/track/add"><Button size="sm">Add</Button></Link>
          <Link href="/track/import"><Button size="sm" variant="outline"><Upload className="mr-1 h-4 w-4" />Import</Button></Link>
          <Link href="/track/tags"><Button size="sm" variant="outline"><Tags className="mr-1 h-4 w-4" />Tags</Button></Link>
          {expenses.length > 0 && (
            <Button size="sm" variant="destructive" onClick={handleDeleteAll}>
              <XCircle className="mr-1 h-4 w-4" />Delete All
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {EXPENSE_CATEGORIES.map((category) => (
              <SelectItem key={category.value} value={category.value}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="wise_csv">Wise CSV</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" className="h-8 w-[140px] text-xs" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} placeholder="From" />
        <Input type="date" className="h-8 w-[140px] text-xs" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} placeholder="To" />
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex gap-4">
          <span>{expenses.length} expenses</span>
          <span className="font-medium">${totalAud.toLocaleString('en-AU', { maximumFractionDigits: 0 })} AUD</span>
        </div>
        <p className="text-xs text-muted-foreground">
          City and country come from the assigned itinerary leg. Use edit to move flights, tickets, or pre-paid costs into the destination where you want them counted.
        </p>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex gap-2 rounded bg-muted p-2">
          <span className="text-sm">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => handleBulkAction('exclude')}>Exclude</Button>
          <Button size="sm" variant="outline" onClick={() => handleBulkAction('include')}>Include</Button>
          <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>Clear</Button>
        </div>
      )}

      <div className="space-y-3 lg:hidden">
        {expenses.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">No expenses yet.</p>
        )}
        {expenses.map((expense) => (
          <Card key={expense.id} className={expense.isExcluded ? 'opacity-60' : ''}>
            <CardContent className="space-y-3 p-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(expense.id)}
                  onChange={() => toggleSelect(expense.id)}
                  className="mt-1 h-4 w-4"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{expense.date}</span>
                    <Badge variant="outline">{categoryLabel(expense.category)}</Badge>
                    {expense.isExcluded ? <Badge variant="destructive">Excluded</Badge> : <Badge variant="secondary">Included</Badge>}
                    {expense.source === 'wise_csv' ? <Badge variant="secondary">Wise</Badge> : null}
                  </div>
                  <div className="text-sm font-medium">
                    {expense.amount.toFixed(2)} {expense.currency}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {expense.amountAud != null
                        ? `$${expense.amountAud.toFixed(2)} AUD`
                        : expense.currency === 'AUD'
                          ? `$${expense.amount.toFixed(2)} AUD`
                          : 'No AUD conversion'}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">{expense.countryName || 'Unassigned'}</span>
                    <span className="text-muted-foreground"> {expense.cityName ? `• ${expense.cityName}` : ''}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {expense.countryName ? formatLegRange(expense.assignmentStartDate, expense.assignmentEndDate) : 'No itinerary leg'}
                  </div>
                  <div className="text-sm">{displayText(expense.description)}</div>
                  <div className="text-xs text-muted-foreground">
                    Merchant: {displayText(expense.merchant)} • Source: {formatSource(expense.source)}
                  </div>
                  {expense.subcategory && (
                    <div className="text-xs text-muted-foreground">Subcategory: {expense.subcategory}</div>
                  )}
                  {expense.loggedBy && (
                    <div className="text-xs text-muted-foreground">Logged by {expense.loggedBy}</div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleExclude(expense.id)}>
                  {expense.isExcluded ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(expense)}>
                  <Edit className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(expense.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="hidden rounded-lg border bg-background lg:block">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-muted/50 text-left">
            <tr className="border-b">
              <th className="w-10 px-3 py-2">
                <span className="sr-only">Select</span>
              </th>
              <th className="w-[8rem] px-3 py-2 font-medium">Date</th>
              <th className="w-[18rem] px-3 py-2 font-medium">Location</th>
              <th className="w-[10rem] px-3 py-2 font-medium">Category</th>
              <th className="w-[9rem] px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Assignment</th>
              <th className="w-[8rem] px-3 py-2 text-right font-medium">Actions</th>
              <th className="w-[4rem] px-3 py-2 text-right font-medium">More</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-muted-foreground">
                  No expenses yet.
                </td>
              </tr>
            )}
            {expenses.map((expense) => {
              const isExpanded = expandedIds.has(expense.id);

              return (
                <Fragment key={expense.id}>
                  <tr className={`border-b align-top ${expense.isExcluded ? 'bg-muted/20 text-muted-foreground' : ''}`}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(expense.id)}
                        onChange={() => toggleSelect(expense.id)}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">{expense.date}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{expense.cityName ? `${expense.cityName}, ${expense.countryName}` : expense.countryName || 'Unassigned'}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {expense.countryName ? formatLegRange(expense.assignmentStartDate, expense.assignmentEndDate) : 'No itinerary leg'}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="outline">{categoryLabel(expense.category)}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <div className="font-medium">
                        {expense.amount.toFixed(2)} {expense.currency}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {expense.amountAud != null
                          ? `$${expense.amountAud.toFixed(2)} AUD`
                          : expense.currency === 'AUD'
                            ? `$${expense.amount.toFixed(2)} AUD`
                            : 'No AUD conversion'}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-sm font-medium">
                        {expense.legId != null ? 'Assigned' : 'Unassigned'}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {expense.legId != null ? 'Counts against this itinerary leg' : 'Will not roll into a destination'}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleExclude(expense.id)}>
                          {expense.isExcluded ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(expense)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(expense.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleExpanded(expense.id)}>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className={expense.isExcluded ? 'bg-muted/10 text-muted-foreground' : 'bg-muted/5'}>
                      <td colSpan={7} className="px-3 py-3">
                        <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                          <div>
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</div>
                            <div className="mt-1 text-sm">{displayText(expense.description)}</div>
                          </div>
                          <div>
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Merchant</div>
                            <div className="mt-1 text-sm">{displayText(expense.merchant)}</div>
                          </div>
                          <div>
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Source</div>
                            <div className="mt-1 flex items-center gap-2 text-sm">
                              <span>{formatSource(expense.source)}</span>
                              {expense.source === 'wise_csv' ? <Badge variant="secondary">Wise</Badge> : null}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</div>
                            <div className="mt-1">
                              {expense.isExcluded ? (
                                <Badge variant="destructive">Excluded</Badge>
                              ) : (
                                <Badge variant="secondary">Included</Badge>
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subcategory</div>
                            <div className="mt-1 text-sm">{displayText(expense.subcategory)}</div>
                          </div>
                          <div>
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Logged By</div>
                            <div className="mt-1 text-sm">{displayText(expense.loggedBy)}</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editExpense} onOpenChange={(open) => {
        if (!open) {
          setEditExpense(null);
          setEditForm(null);
        }
      }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Expense</DialogTitle></DialogHeader>
          {editForm && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Date</Label>
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={editForm.date}
                    onChange={(e) => setEditForm((prev) => prev ? { ...prev, date: e.target.value } : prev)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Amount</Label>
                  <Input
                    type="number"
                    className="h-8 text-xs"
                    value={editForm.amount}
                    onChange={(e) => setEditForm((prev) => prev ? { ...prev, amount: e.target.value } : prev)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Currency</Label>
                  <Input
                    className="h-8 text-xs"
                    value={editForm.currency}
                    onChange={(e) => setEditForm((prev) => prev ? { ...prev, currency: e.target.value.toUpperCase() } : prev)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select
                    value={editForm.category}
                    onValueChange={(value) => setEditForm((prev) => prev ? { ...prev, category: value } : prev)}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">City / Country Assignment</Label>
                <Select
                  value={editForm.legId}
                  onValueChange={(value) => setEditForm((prev) => prev ? { ...prev, legId: value } : prev)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select itinerary leg" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED_LEG_VALUE}>Unassigned</SelectItem>
                    {legs.map((leg) => (
                      <SelectItem
                        key={leg.id}
                        value={String(leg.id)}
                        textValue={`${leg.cityName}, ${leg.countryName}`}
                      >
                        <div className="flex flex-col">
                          <span>{leg.cityName}, {leg.countryName}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatLegRange(leg.startDate, leg.endDate)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  This controls which city and country receive the spend on the dashboard.
                </p>
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Input
                  className="h-8 text-xs"
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => prev ? { ...prev, description: e.target.value } : prev)}
                />
              </div>
              <div>
                <Label className="text-xs">Merchant</Label>
                <Input
                  className="h-8 text-xs"
                  value={editForm.merchant}
                  onChange={(e) => setEditForm((prev) => prev ? { ...prev, merchant: e.target.value } : prev)}
                />
              </div>
              <div>
                <Label className="text-xs">Subcategory</Label>
                <Input
                  className="h-8 text-xs"
                  value={editForm.subcategory}
                  onChange={(e) => setEditForm((prev) => prev ? { ...prev, subcategory: e.target.value } : prev)}
                />
              </div>
              <Button onClick={handleEditSave} className="w-full">Save Changes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
