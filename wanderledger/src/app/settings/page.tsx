'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Download } from 'lucide-react';
import Link from 'next/link';

interface FixedCost {
  id: number;
  description: string;
  amountAud: number;
  category: string | null;
  countryId: string | null;
  date: string | null;
  isPaid: number;
  notes: string | null;
}

interface Country {
  id: string;
  name: string;
}

const CATEGORIES = ['visa', 'insurance', 'flights', 'gear', 'other'];

export default function SettingsPage() {
  const [costs, setCosts] = useState<FixedCost[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newCost, setNewCost] = useState({
    description: '',
    amountAud: 0,
    category: 'other',
    countryId: '',
    date: '',
    notes: '',
  });

  const fetchData = useCallback(async () => {
    const [costsRes, countriesRes] = await Promise.all([
      fetch('/api/fixed-costs'),
      fetch('/api/countries'),
    ]);
    const costsData = await costsRes.json();
    const countriesData = await countriesRes.json();
    setCosts(costsData.data || []);
    setCountries((countriesData.data || []).map((c: Country & { cities?: unknown[] }) => ({ id: c.id, name: c.name })));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async () => {
    await fetch('/api/fixed-costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newCost,
        countryId: newCost.countryId || null,
        date: newCost.date || null,
        notes: newCost.notes || null,
      }),
    });
    setAddOpen(false);
    setNewCost({ description: '', amountAud: 0, category: 'other', countryId: '', date: '', notes: '' });
    fetchData();
  };

  const handleTogglePaid = async (cost: FixedCost) => {
    await fetch(`/api/fixed-costs/${cost.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPaid: cost.isPaid ? 0 : 1 }),
    });
    fetchData();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/fixed-costs/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const totalPaid = costs.filter(c => c.isPaid).reduce((s, c) => s + c.amountAud, 0);
  const totalUnpaid = costs.filter(c => !c.isPaid).reduce((s, c) => s + c.amountAud, 0);
  const total = totalPaid + totalUnpaid;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="flex flex-wrap gap-2 mt-4">
          <Link href="/settings/cities">
            <Button variant="outline">City Cost Editor</Button>
          </Link>
          <a href="/api/export?format=json" download>
            <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Export JSON</Button>
          </a>
          <a href="/api/export?format=csv" download>
            <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Export CSV</Button>
          </a>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Fixed Costs</CardTitle>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Fixed Cost</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Description</Label>
                  <Input value={newCost.description} onChange={(e) => setNewCost(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div>
                  <Label>Amount (AUD)</Label>
                  <Input type="number" value={newCost.amountAud || ''} onChange={(e) => setNewCost(p => ({ ...p, amountAud: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={newCost.category} onValueChange={(v) => setNewCost(p => ({ ...p, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Country (optional)</Label>
                  <Select value={newCost.countryId} onValueChange={(v) => setNewCost(p => ({ ...p, countryId: v }))}>
                    <SelectTrigger><SelectValue placeholder="General" /></SelectTrigger>
                    <SelectContent>
                      {countries.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date (optional)</Label>
                  <Input type="date" value={newCost.date} onChange={(e) => setNewCost(p => ({ ...p, date: e.target.value }))} />
                </div>
                <Button onClick={handleAdd} className="w-full" disabled={!newCost.description || !newCost.amountAud}>
                  Add Fixed Cost
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4 text-sm">
            <span>Total: <strong>${total.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</strong></span>
            <span className="text-green-600">Paid: ${totalPaid.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</span>
            <span className="text-orange-600">Unpaid: ${totalUnpaid.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</span>
          </div>

          {costs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No fixed costs yet.</p>
          ) : (
            <div className="space-y-2">
              {costs.map((cost) => (
                <div key={cost.id} className="flex items-center gap-3 p-2 rounded border">
                  <Switch
                    checked={!!cost.isPaid}
                    onCheckedChange={() => handleTogglePaid(cost)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cost.isPaid ? 'line-through text-muted-foreground' : 'font-medium'}>
                        {cost.description}
                      </span>
                      {cost.category && (
                        <Badge variant="outline" className="text-xs capitalize">{cost.category}</Badge>
                      )}
                    </div>
                    {cost.date && <p className="text-xs text-muted-foreground">{cost.date}</p>}
                  </div>
                  <span className="font-medium">${cost.amountAud.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(cost.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
