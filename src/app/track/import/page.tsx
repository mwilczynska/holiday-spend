'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InlineLoadingState, LoadingButtonLabel } from '@/components/ui/loading-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EXPENSE_CATEGORIES } from '@/types';
import { Upload, Check, Trash2 } from 'lucide-react';

interface ParsedExpense {
  date: string;
  amount: number;
  currency: string;
  amountAud?: number | null;
  category: string;
  subcategory: string;
  description: string;
  merchant: string;
  wiseTxnId: string;
  skip: boolean;
  skipReason?: string;
}

interface PreviewData {
  toImport: ParsedExpense[];
  skipped: ParsedExpense[];
  duplicates: ParsedExpense[];
  total: number;
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [editableImports, setEditableImports] = useState<ParsedExpense[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; duplicates: number } | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<number | null>(null);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setPreview(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/expenses/import/csv', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.data?.preview) {
        setPreview(data.data);
        setEditableImports([...data.data.toImport]);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleCategoryChange = (index: number, category: string) => {
    const updated = [...editableImports];
    updated[index] = { ...updated[index], category };
    setEditableImports(updated);
  };

  const handleConfirmImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('confirm', 'true');

    try {
      const res = await fetch('/api/expenses/import/csv', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setResult(data.data);
      setPreview(null);
    } finally {
      setImporting(false);
    }
  };

  const handleClearImported = async () => {
    if (!confirm('Delete ALL imported Wise CSV transactions? This cannot be undone.')) return;
    setClearing(true);
    setClearResult(null);
    try {
      const res = await fetch('/api/expenses/import/clear', { method: 'DELETE' });
      const data = await res.json();
      setClearResult(data.data?.deleted ?? 0);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Import Wise CSV</h1>
        <Button variant="destructive" size="sm" onClick={handleClearImported} disabled={clearing}>
          <Trash2 className="h-4 w-4 mr-1" />
          <LoadingButtonLabel idle="Clear All Imported" loading="Clearing..." isLoading={clearing} />
        </Button>
      </div>

      {/* Upload */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <input ref={fileRef} type="file" accept=".csv" className="text-sm" />
            <Button onClick={handleUpload} disabled={uploading}>
              <Upload className="h-4 w-4 mr-2" />
              <LoadingButtonLabel idle="Parse CSV" loading="Parsing..." isLoading={uploading} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Upload a Wise CSV export. Transactions will be parsed, categorised, and deduplicated.
          </p>
          {uploading ? (
            <div className="mt-3">
              <InlineLoadingState
                title="Parsing CSV and preparing preview"
                detail="Wise rows are being normalized, categorized, and checked for duplicates."
                compact
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Clear result */}
      {clearResult !== null && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-destructive">Deleted {clearResult} imported transactions.</p>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-600">
              <Check className="h-5 w-5" />
              <span className="font-medium">Import complete!</span>
            </div>
            <p className="text-sm mt-2">
              Imported: {result.imported} | Skipped: {result.skipped} | Duplicates: {result.duplicates}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {preview && (
        <div className="space-y-4">
          <div className="flex gap-4 text-sm">
            <Badge variant="default">{editableImports.length} to import</Badge>
            <Badge variant="secondary">{preview.skipped.length} skipped</Badge>
            <Badge variant="outline">{preview.duplicates.length} duplicates</Badge>
          </div>

          {/* Importable transactions */}
          {editableImports.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Transactions to Import</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-card border-b">
                      <tr>
                        <th className="p-2 text-left">Date</th>
                        <th className="p-2 text-right">Amount</th>
                        <th className="p-2 text-left">Description</th>
                        <th className="p-2 text-left">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editableImports.map((exp, i) => (
                        <tr key={i} className="border-b hover:bg-muted/50">
                          <td className="p-2">{exp.date}</td>
                          <td className="p-2 text-right font-medium">
                            {exp.amount.toFixed(2)} {exp.currency}
                            {exp.amountAud != null && exp.currency !== 'AUD' && (
                              <span className="text-muted-foreground ml-1">(${exp.amountAud.toFixed(2)})</span>
                            )}
                          </td>
                          <td className="p-2 truncate max-w-[200px]">{exp.description || exp.merchant}</td>
                          <td className="p-2">
                            <Select value={exp.category} onValueChange={(v) => handleCategoryChange(i, v)}>
                              <SelectTrigger className="h-6 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Skipped transactions */}
          {preview.skipped.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Skipped ({preview.skipped.length})</CardTitle></CardHeader>
              <CardContent className="p-2">
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {preview.skipped.map((exp, i) => (
                    <div key={i} className="flex justify-between text-xs text-muted-foreground">
                      <span>{exp.date} — {exp.description}</span>
                      <span>{exp.skipReason}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Button onClick={handleConfirmImport} disabled={importing || editableImports.length === 0} className="w-full">
            <LoadingButtonLabel
              idle={`Import ${editableImports.length} Transactions`}
              loading="Importing..."
              isLoading={importing}
            />
          </Button>
        </div>
      )}
    </div>
  );
}
