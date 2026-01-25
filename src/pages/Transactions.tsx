import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TransactionsTable } from '@/components/transactions/TransactionsTable';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { useMonthNavigation } from '@/hooks/useMonthNavigation';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { Transaction, TransactionKind, TransactionStatus } from '@/types/finance';

export default function Transactions() {
  const { monthRef } = useMonthNavigation();
  const { categories } = useCategories();
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<TransactionKind | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const { transactions, createTransaction, updateTransaction, deleteTransaction } = useTransactions({
    monthRef,
    kind: kindFilter === 'all' ? undefined : kindFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: search || undefined,
  });

  const handleSubmit = (data: any) => {
    if (editingTransaction) {
      updateTransaction.mutate({ id: editingTransaction.id, ...data });
    } else {
      createTransaction.mutate(data);
    }
    setFormOpen(false);
    setEditingTransaction(null);
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setFormOpen(true);
  };

  const handleToggleStatus = (transaction: Transaction) => {
    updateTransaction.mutate({
      id: transaction.id,
      status: transaction.status === 'paid' ? 'pending' : 'paid',
    });
  };

  return (
    <AppLayout title="Transações">
      <div className="space-y-4 animate-fade-in">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar transações..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as any)}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="income">Receita</SelectItem>
              <SelectItem value="fixed">Fixo</SelectItem>
              <SelectItem value="variable">Variável</SelectItem>
              <SelectItem value="investment">Investimento</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditingTransaction(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Nova Transação
          </Button>
        </div>

        <TransactionsTable
          transactions={transactions}
          onEdit={handleEdit}
          onDelete={(id) => deleteTransaction.mutate(id)}
          onToggleStatus={handleToggleStatus}
        />

        <TransactionForm
          open={formOpen}
          onOpenChange={setFormOpen}
          onSubmit={handleSubmit}
          categories={categories}
          transaction={editingTransaction}
        />
      </div>
    </AppLayout>
  );
}
