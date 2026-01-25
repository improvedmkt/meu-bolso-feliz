import { useState, useCallback } from 'react';
import { Upload, FileText } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImportPreview, ParsedTransaction } from '@/components/import/ImportPreview';
import { useCategories } from '@/hooks/useCategories';
import { useTransactions } from '@/hooks/useTransactions';
import { useMonthNavigation } from '@/hooks/useMonthNavigation';
import { TransactionKind } from '@/types/finance';
import { toast } from 'sonner';

function generateHash(date: string, description: string, amount: number): string {
  return `${date}-${description.toLowerCase().replace(/\s+/g, '-')}-${amount}`;
}

function parseCSV(content: string): ParsedTransaction[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  
  const transactions: ParsedTransaction[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,;]/).map(c => c.replace(/"/g, '').trim());
    if (cols.length < 3) continue;
    
    const dateStr = cols[0];
    const description = cols[1];
    const amountStr = cols[2].replace(/[R$\s]/g, '').replace(',', '.');
    const amount = parseFloat(amountStr);
    
    if (isNaN(amount) || !dateStr || !description) continue;
    
    // Parse date (try multiple formats)
    let date = '';
    const dateParts = dateStr.match(/(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})/);
    if (dateParts) {
      const [, p1, p2, p3] = dateParts;
      if (p1.length === 4) date = `${p1}-${p2.padStart(2,'0')}-${p3.padStart(2,'0')}`;
      else date = `${p3}-${p2.padStart(2,'0')}-${p1.padStart(2,'0')}`;
    }
    if (!date) continue;
    
    const hash = generateHash(date, description, amount);
    
    transactions.push({
      id: `import-${i}`,
      date,
      description,
      amount,
      kind: amount > 0 ? 'income' : 'variable',
      category_id: null,
      external_hash: hash,
      isDuplicate: false,
      selected: true,
    });
  }
  
  return transactions;
}

export default function Import() {
  const { monthRef } = useMonthNavigation();
  const { categories } = useCategories();
  const { transactions: existingTx, importTransactions } = useTransactions({ monthRef });
  const [parsedData, setParsedData] = useState<ParsedTransaction[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      let parsed = parseCSV(content);
      
      // Check for duplicates
      const existingHashes = new Set(existingTx.filter(t => t.external_hash).map(t => t.external_hash));
      parsed = parsed.map(t => ({
        ...t,
        isDuplicate: existingHashes.has(t.external_hash),
        selected: !existingHashes.has(t.external_hash),
      }));
      
      setParsedData(parsed);
      toast.success(`${parsed.length} transações encontradas`);
    };
    reader.readAsText(file);
  }, [existingTx]);

  const handleImport = async () => {
    if (!parsedData) return;
    setIsImporting(true);
    const toImport = parsedData.filter(t => t.selected && !t.isDuplicate);
    await importTransactions.mutateAsync(toImport);
    setParsedData(null);
    setIsImporting(false);
  };

  return (
    <AppLayout title="Importar Extrato">
      <div className="space-y-6 animate-fade-in">
        {!parsedData ? (
          <Card>
            <CardHeader><CardTitle>Upload de Arquivo</CardTitle></CardHeader>
            <CardContent>
              <label className="flex cursor-pointer flex-col items-center gap-4 rounded-lg border-2 border-dashed p-12 hover:border-primary/50">
                <Upload className="h-12 w-12 text-muted-foreground" />
                <div className="text-center">
                  <p className="font-medium">Arraste um arquivo CSV ou clique para selecionar</p>
                  <p className="text-sm text-muted-foreground">Formato: data, descrição, valor</p>
                </div>
                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
              </label>
            </CardContent>
          </Card>
        ) : (
          <ImportPreview
            transactions={parsedData}
            categories={categories}
            onToggleSelect={(id) => setParsedData(prev => prev!.map(t => t.id === id ? {...t, selected: !t.selected} : t))}
            onToggleSelectAll={(sel) => setParsedData(prev => prev!.map(t => t.isDuplicate ? t : {...t, selected: sel}))}
            onChangeCategory={(id, catId) => setParsedData(prev => prev!.map(t => t.id === id ? {...t, category_id: catId} : t))}
            onChangeKind={(id, kind) => setParsedData(prev => prev!.map(t => t.id === id ? {...t, kind} : t))}
            onImport={handleImport}
            onCancel={() => setParsedData(null)}
            isImporting={isImporting}
          />
        )}
      </div>
    </AppLayout>
  );
}
