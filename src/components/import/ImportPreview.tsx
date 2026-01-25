import { useState } from 'react';
import { Check, X, AlertCircle } from 'lucide-react';
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
  const selectedCount = transactions.filter((t) => t.selected && !t.isDuplicate).length;
  const duplicateCount = transactions.filter((t) => t.isDuplicate).length;
  const allSelected = transactions.every((t) => t.selected || t.isDuplicate);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              Preview da Importação
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {transactions.length} transações encontradas
              {duplicateCount > 0 && (
                <span className="text-warning"> ({duplicateCount} duplicadas)</span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} disabled={isImporting}>
              Cancelar
            </Button>
            <Button onClick={onImport} disabled={isImporting || selectedCount === 0}>
              {isImporting ? 'Importando...' : `Importar ${selectedCount} transações`}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => onToggleSelectAll(!!checked)}
                  />
                </th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  className={cn(
                    'border-b last:border-0',
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
                  <td className="px-4 py-3 text-sm tabular-nums">
                    {formatDate(transaction.date)}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-sm">
                    {transaction.description}
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
                    <Select
                      value={transaction.category_id || 'none'}
                      onValueChange={(value) =>
                        onChangeCategory(transaction.id, value === 'none' ? null : value)
                      }
                      disabled={transaction.isDuplicate}
                    >
                      <SelectTrigger className="h-8 w-[130px]">
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
                      <Badge variant="outline" className="bg-warning/10 text-warning">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        Duplicada
                      </Badge>
                    ) : transaction.selected ? (
                      <Badge variant="outline" className="bg-income/10 text-income">
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
        </div>
      </CardContent>
    </Card>
  );
}
