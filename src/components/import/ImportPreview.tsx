import { useMemo, useState } from 'react';
import { Check, X, AlertCircle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Category, TransactionKind } from '@/types/finance';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface ParsedTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  kind: TransactionKind;
  category_id?: string | null;
  external_hash: string;
  isDuplicate: boolean;
  selected: boolean;
  suggestedCategory?: string;
}

interface ImportPreviewProps {
  transactions: ParsedTransaction[];
  categories: Category[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (selected: boolean) => void;
  onChangeCategory: (id: string, categoryId: string | null) => void;
  onChangeKind: (id: string, kind: TransactionKind) => void;
  onImport: () => void;
  onCancel: () => void;
  isImporting: boolean;
}

export function ImportPreview({
  transactions,
  categories,
  onToggleSelect,
  onToggleSelectAll,
  onChangeCategory,
  onChangeKind,
  onImport,
  onCancel,
  isImporting,
}: ImportPreviewProps) {
  const [sortField, setSortField] = useState<'date' | 'amount'>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'selected' | 'duplicate'>('all');

  const stats = useMemo(() => {
    const selected = transactions.filter(t => t.selected && !t.isDuplicate);
    const duplicates = transactions.filter(t => t.isDuplicate);
    const autoCategorized = transactions.filter(t => t.suggestedCategory);
    const totalIncome = selected.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalExpense = selected.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    
    return {
      total: transactions.length,
      selectedCount: selected.length,
      duplicateCount: duplicates.length,
      autoCategorizedCount: autoCategorized.length,
      totalIncome,
      totalExpense,
    };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];
    
    if (filterStatus === 'selected') {
      filtered = filtered.filter(t => t.selected && !t.isDuplicate);
    } else if (filterStatus === 'duplicate') {
      filtered = filtered.filter(t => t.isDuplicate);
    }
    
    filtered.sort((a, b) => {
      if (sortField === 'date') {
        return sortAsc 
          ? a.date.localeCompare(b.date) 
          : b.date.localeCompare(a.date);
      } else {
        return sortAsc ? a.amount - b.amount : b.amount - a.amount;
      }
    });
    
    return filtered;
  }, [transactions, filterStatus, sortField, sortAsc]);

  const allSelected = transactions.every(t => t.selected || t.isDuplicate);

  const handleSort = (field: 'date' | 'amount') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const SortIcon = ({ field }: { field: 'date' | 'amount' }) => {
    if (sortField !== field) return null;
    return sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              Preview da Importação
            </CardTitle>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">
                {stats.total} transações
              </Badge>
              {stats.duplicateCount > 0 && (
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                  {stats.duplicateCount} duplicadas
                </Badge>
              )}
              {stats.autoCategorizedCount > 0 && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  <Sparkles className="mr-1 h-3 w-3" />
                  {stats.autoCategorizedCount} auto-categorizadas
                </Badge>
              )}
            </div>
            <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
              <span>Receitas: <span className="font-medium text-income">{formatCurrency(stats.totalIncome)}</span></span>
              <span>Gastos: <span className="font-medium text-expense">{formatCurrency(stats.totalExpense)}</span></span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} disabled={isImporting}>
              Cancelar
            </Button>
            <Button onClick={onImport} disabled={isImporting || stats.selectedCount === 0}>
              {isImporting ? 'Importando...' : `Importar ${stats.selectedCount} transações`}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {/* Filters */}
      <div className="border-t px-4 py-2">
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Filtrar:</span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={filterStatus === 'all' ? 'secondary' : 'ghost'}
              onClick={() => setFilterStatus('all')}
            >
              Todas
            </Button>
            <Button
              size="sm"
              variant={filterStatus === 'selected' ? 'secondary' : 'ghost'}
              onClick={() => setFilterStatus('selected')}
            >
              Selecionadas
            </Button>
            <Button
              size="sm"
              variant={filterStatus === 'duplicate' ? 'secondary' : 'ghost'}
              onClick={() => setFilterStatus('duplicate')}
            >
              Duplicadas
            </Button>
          </div>
        </div>
      </div>

      <CardContent className="p-0">
        <div className="max-h-[500px] overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => onToggleSelectAll(!!checked)}
                  />
                </th>
                <th 
                  className="cursor-pointer px-4 py-3 hover:text-foreground"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center gap-1">
                    Data <SortIcon field="date" />
                  </div>
                </th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Categoria</th>
                <th 
                  className="cursor-pointer px-4 py-3 text-right hover:text-foreground"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Valor <SortIcon field="amount" />
                  </div>
                </th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  className={cn(
                    'border-b last:border-0 transition-colors',
                    transaction.isDuplicate && 'bg-muted/50 opacity-60'
                  )}
                >
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={transaction.selected}
                      onCheckedChange={() => onToggleSelect(transaction.id)}
                      disabled={transaction.isDuplicate}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums whitespace-nowrap">
                    {formatDate(transaction.date)}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-sm">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-default">{transaction.description}</span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        {transaction.description}
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={transaction.kind}
                      onValueChange={(value) =>
                        onChangeKind(transaction.id, value as TransactionKind)
                      }
                      disabled={transaction.isDuplicate}
                    >
                      <SelectTrigger className="h-8 w-[110px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Receita</SelectItem>
                        <SelectItem value="fixed">Fixo</SelectItem>
                        <SelectItem value="variable">Variável</SelectItem>
                        <SelectItem value="investment">Invest.</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Select
                        value={transaction.category_id || 'none'}
                        onValueChange={(value) =>
                          onChangeCategory(transaction.id, value === 'none' ? null : value)
                        }
                        disabled={transaction.isDuplicate}
                      >
                        <SelectTrigger className={cn(
                          "h-8 w-[140px]",
                          transaction.suggestedCategory && "border-primary/50"
                        )}>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem categoria</SelectItem>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {transaction.suggestedCategory && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Sparkles className="h-3 w-3 text-primary" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Sugestão automática: {transaction.suggestedCategory}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={cn(
                        'font-medium tabular-nums',
                        transaction.amount >= 0 ? 'text-income' : 'text-expense'
                      )}
                    >
                      {formatCurrency(transaction.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {transaction.isDuplicate ? (
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        Duplicada
                      </Badge>
                    ) : transaction.selected ? (
                      <Badge variant="outline" className="bg-income/10 text-income border-income/30">
                        <Check className="mr-1 h-3 w-3" />
                        Importar
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-muted-foreground">
                        <X className="mr-1 h-3 w-3" />
                        Ignorar
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredTransactions.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              Nenhuma transação encontrada com o filtro selecionado
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
