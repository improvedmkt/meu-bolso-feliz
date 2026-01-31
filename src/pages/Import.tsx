import { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ImportPreview, ParsedTransaction } from '@/components/import/ImportPreview';
import { useCategories } from '@/hooks/useCategories';
import { useTransactions } from '@/hooks/useTransactions';
import { useMonthNavigation } from '@/hooks/useMonthNavigation';
import { useRecurringBills } from '@/hooks/useRecurringBills';
import { toast } from 'sonner';
import { 
  parseStatementFile, 
  markDuplicates, 
  autoCategorizeTransactions, 
  SUPPORTED_BANKS,
  CategoryKeyword,
} from '@/lib/statementParser';

export default function Import() {
  const { monthRef } = useMonthNavigation();
  const { categories } = useCategories();
  const { transactions: existingTx, importTransactions } = useTransactions({ monthRef });
  const { recurringBills } = useRecurringBills();
  
  const [selectedBank, setSelectedBank] = useState('auto');
  const [parsedData, setParsedData] = useState<ParsedTransaction[] | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [bankDetected, setBankDetected] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Build category keywords from recurring bills and categories
  const getCategoryKeywords = useCallback((): CategoryKeyword[] => {
    const keywords: CategoryKeyword[] = [];
    
    // Add keywords from recurring bills
    recurringBills.forEach(bill => {
      if (bill.match_keywords && bill.category_id) {
        const cat = categories.find(c => c.id === bill.category_id);
        if (cat) {
          keywords.push({
            categoryId: bill.category_id,
            categoryName: cat.name,
            keywords: bill.match_keywords.split(',').map(k => k.trim()).filter(Boolean),
          });
        }
      }
    });

    // Add some default keywords based on category names
    categories.forEach(cat => {
      const defaultKeywords: Record<string, string[]> = {
        'Moradia': ['aluguel', 'condominio', 'condomínio', 'iptu'],
        'Luz': ['energia', 'eletricidade', 'cpfl', 'cemig', 'enel', 'light'],
        'Alimentação': ['ifood', 'uber eats', 'rappi', 'supermercado', 'mercado', 'restaurante', 'padaria'],
        'Academia': ['academia', 'smartfit', 'smart fit', 'bluefit', 'gym'],
        'Gasolina': ['posto', 'combustivel', 'gasolina', 'etanol', 'shell', 'ipiranga', 'petrobras'],
        'Transporte': ['uber', '99', 'cabify', 'metro', 'metrô', 'onibus', 'ônibus'],
        'Saúde': ['farmacia', 'farmácia', 'drogaria', 'hospital', 'clinica', 'clínica', 'médico'],
        'Investimentos': ['btg', 'xp', 'rico', 'clear', 'nuinvest', 'tesouro', 'cdb', 'lci', 'lca'],
        'Receita': ['salario', 'salário', 'pix recebido', 'transferencia recebida'],
      };
      
      const catKeywords = defaultKeywords[cat.name];
      if (catKeywords) {
        keywords.push({
          categoryId: cat.id,
          categoryName: cat.name,
          keywords: catKeywords,
        });
      }
    });

    return keywords;
  }, [categories, recurringBills]);

  const processFile = async (file: File) => {
    setIsParsing(true);
    setParseErrors([]);
    setParsedData(null);
    setBankDetected(null);

    try {
      const bankHint = selectedBank === 'auto' ? undefined : selectedBank;
      const result = await parseStatementFile(file, bankHint);
      
      if (!result.success || result.transactions.length === 0) {
        setParseErrors(result.errors.length > 0 ? result.errors : ['Nenhuma transação encontrada no arquivo']);
        toast.error('Erro ao processar arquivo');
        return;
      }

      // Mark duplicates
      const existingHashes = new Set(existingTx.filter(t => t.external_hash).map(t => t.external_hash as string));
      let processed = markDuplicates(result.transactions, existingHashes);
      
      // Auto-categorize
      const categoryKeywords = getCategoryKeywords();
      processed = autoCategorizeTransactions(processed, categoryKeywords);
      
      setParsedData(processed);
      setBankDetected(result.bankName || null);
      
      const duplicateCount = processed.filter(t => t.isDuplicate).length;
      const categorizedCount = processed.filter(t => t.category_id).length;
      
      let message = `${processed.length} transações encontradas`;
      if (duplicateCount > 0) message += `, ${duplicateCount} duplicadas`;
      if (categorizedCount > 0) message += `, ${categorizedCount} auto-categorizadas`;
      
      toast.success(message);
      
      if (result.errors.length > 0) {
        setParseErrors(result.errors);
      }
    } catch (error) {
      console.error('Parse error:', error);
      setParseErrors([error instanceof Error ? error.message : 'Erro ao processar arquivo']);
      toast.error('Erro ao processar arquivo');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    // Reset input to allow re-uploading same file
    e.target.value = '';
  }, [selectedBank, existingTx, getCategoryKeywords]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [selectedBank, existingTx, getCategoryKeywords]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleImport = async () => {
    if (!parsedData) return;
    setIsImporting(true);
    
    try {
      const toImport = parsedData
        .filter(t => t.selected && !t.isDuplicate)
        .map(({ id, isDuplicate, selected, suggestedCategory, ...rest }) => rest);
      
      await importTransactions.mutateAsync(toImport);
      setParsedData(null);
      setParseErrors([]);
      setBankDetected(null);
    } finally {
      setIsImporting(false);
    }
  };

  const handleUpdateTransaction = (id: string, updates: Partial<ParsedTransaction>) => {
    setParsedData(prev => prev!.map(t => 
      t.id === id ? { ...t, ...updates } : t
    ));
  };

  return (
    <AppLayout title="Importar Extrato">
      <div className="space-y-6 animate-fade-in">
        {!parsedData ? (
          <>
            {/* Bank selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Configuração</CardTitle>
                <CardDescription>
                  Selecione o banco para melhor compatibilidade ou deixe em automático
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-w-xs">
                  <Label htmlFor="bank-select">Banco</Label>
                  <Select value={selectedBank} onValueChange={setSelectedBank}>
                    <SelectTrigger id="bank-select" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_BANKS.map(bank => (
                        <SelectItem key={bank.value} value={bank.value}>
                          {bank.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* File upload */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Upload de Arquivo</CardTitle>
                <CardDescription>
                  Formatos suportados: CSV, OFX, QFX
                </CardDescription>
              </CardHeader>
              <CardContent>
                <label
                  className={`flex cursor-pointer flex-col items-center gap-4 rounded-lg border-2 border-dashed p-12 transition-colors ${
                    dragActive 
                      ? 'border-primary bg-primary/5' 
                      : 'border-muted-foreground/25 hover:border-primary/50'
                  } ${isParsing ? 'pointer-events-none opacity-60' : ''}`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  {isParsing ? (
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  ) : (
                    <Upload className="h-12 w-12 text-muted-foreground" />
                  )}
                  <div className="text-center">
                    <p className="font-medium">
                      {isParsing 
                        ? 'Processando arquivo...' 
                        : 'Arraste um arquivo ou clique para selecionar'}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      CSV (Excel), OFX ou QFX do seu banco
                    </p>
                  </div>
                  <input 
                    type="file" 
                    accept=".csv,.txt,.ofx,.qfx" 
                    className="hidden" 
                    onChange={handleFileUpload}
                    disabled={isParsing} 
                  />
                </label>

                {/* Errors */}
                {parseErrors.length > 0 && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <ul className="list-inside list-disc">
                        {parseErrors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Instructions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Como exportar o extrato</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div>
                  <h4 className="font-medium text-foreground">Nubank</h4>
                  <p>App → Extrato → Exportar → CSV ou OFX</p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Itaú</h4>
                  <p>Internet Banking → Extrato → Exportar → OFX</p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Bradesco</h4>
                  <p>Internet Banking → Extrato → Salvar como → OFX ou Excel</p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Outros bancos</h4>
                  <p>Procure pela opção de exportar extrato em CSV ou OFX no app ou internet banking</p>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            {/* Bank detected info */}
            {bankDetected && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Banco detectado: <strong>{bankDetected}</strong>
                </AlertDescription>
              </Alert>
            )}

            {/* Preview errors */}
            {parseErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Alguns erros durante o processamento:
                  <ul className="mt-1 list-inside list-disc">
                    {parseErrors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {parseErrors.length > 5 && (
                      <li>...e mais {parseErrors.length - 5} erros</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <ImportPreview
              transactions={parsedData}
              categories={categories}
              onToggleSelect={(id) => handleUpdateTransaction(id, { 
                selected: !parsedData.find(t => t.id === id)?.selected 
              })}
              onToggleSelectAll={(sel) => setParsedData(prev => 
                prev!.map(t => t.isDuplicate ? t : { ...t, selected: sel })
              )}
              onChangeCategory={(id, catId) => handleUpdateTransaction(id, { category_id: catId })}
              onChangeKind={(id, kind) => handleUpdateTransaction(id, { kind })}
              onImport={handleImport}
              onCancel={() => {
                setParsedData(null);
                setParseErrors([]);
                setBankDetected(null);
              }}
              isImporting={isImporting}
            />
          </>
        )}
      </div>
    </AppLayout>
  );
}
