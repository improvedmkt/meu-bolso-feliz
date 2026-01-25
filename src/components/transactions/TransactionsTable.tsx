import { Edit2, Trash2, Check, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Transaction, TransactionKind } from '@/types/finance';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

interface TransactionsTableProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (transaction: Transaction) => void;
}

const kindLabels: Record<TransactionKind, string> = {
  income: 'Receita',
  fixed: 'Fixo',
  variable: 'Variável',
  investment: 'Investimento',
};

const kindColors: Record<TransactionKind, string> = {
  income: 'bg-income/10 text-income border-income/20',
  fixed: 'bg-primary/10 text-primary border-primary/20',
  variable: 'bg-muted text-muted-foreground border-muted',
  investment: 'bg-investment/10 text-investment border-investment/20',
};

export function TransactionsTable({
  transactions,
  onEdit,
  onDelete,
  onToggleStatus,
}: TransactionsTableProps) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Data</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="w-[100px]">Tipo</TableHead>
            <TableHead className="w-[140px]">Categoria</TableHead>
            <TableHead className="w-[80px]">Status</TableHead>
            <TableHead className="w-[120px] text-right">Valor</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                Nenhuma transação encontrada
              </TableCell>
            </TableRow>
          ) : (
            transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell className="tabular-nums text-muted-foreground">
                  {formatDate(transaction.date)}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{transaction.description}</p>
                    {transaction.notes && (
                      <p className="text-xs text-muted-foreground">{transaction.notes}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn('font-normal', kindColors[transaction.kind])}>
                    {kindLabels[transaction.kind]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {transaction.category ? (
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: transaction.category.color || '#6B7280' }}
                      />
                      <span className="text-sm">{transaction.category.name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => onToggleStatus(transaction)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                      transaction.status === 'paid'
                        ? 'bg-income/10 text-income hover:bg-income/20'
                        : 'bg-warning/10 text-warning hover:bg-warning/20'
                    )}
                  >
                    {transaction.status === 'paid' ? (
                      <>
                        <Check className="h-3 w-3" />
                        Pago
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3" />
                        Pend.
                      </>
                    )}
                  </button>
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={cn(
                      'font-semibold tabular-nums',
                      transaction.amount >= 0 ? 'text-income' : 'text-expense'
                    )}
                  >
                    {formatCurrency(transaction.amount)}
                  </span>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(transaction)}>
                        <Edit2 className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-expense"
                        onClick={() => onDelete(transaction.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
