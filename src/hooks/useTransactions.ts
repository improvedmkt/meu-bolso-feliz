import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Transaction, TransactionKind, TransactionStatus, TransactionSource } from '@/types/finance';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getMonthEnd } from '@/lib/format';

interface TransactionFilters {
  monthRef: string;
  kind?: TransactionKind;
  categoryId?: string;
  status?: TransactionStatus;
  search?: string;
}

export function useTransactions(filters: TransactionFilters) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const monthStart = filters.monthRef;
  const monthEnd = getMonthEnd(new Date(filters.monthRef + 'T12:00:00')).toISOString().split('T')[0];

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', user?.id, filters],
    queryFn: async () => {
      if (!user) return [];
      
      let query = supabase
        .from('transactions')
        .select('*, category:categories(*)')
        .eq('user_id', user.id)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: false });

      if (filters.kind) {
        query = query.eq('kind', filters.kind);
      }
      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.search) {
        query = query.ilike('description', `%${filters.search}%`);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!user,
  });

  const createTransaction = useMutation({
    mutationFn: async (transaction: {
      date: string;
      description: string;
      amount: number;
      kind: TransactionKind;
      category_id?: string | null;
      status?: TransactionStatus;
      source?: TransactionSource;
      external_hash?: string | null;
      notes?: string | null;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('transactions')
        .insert({ ...transaction, user_id: user.id })
        .select('*, category:categories(*)')
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-summary'] });
      toast.success('Transação criada com sucesso');
    },
    onError: () => {
      toast.error('Erro ao criar transação');
    },
  });

  const updateTransaction = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Transaction> & { id: string }) => {
      const { data, error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', id)
        .select('*, category:categories(*)')
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-summary'] });
      toast.success('Transação atualizada');
    },
    onError: () => {
      toast.error('Erro ao atualizar transação');
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-summary'] });
      toast.success('Transação excluída');
    },
    onError: () => {
      toast.error('Erro ao excluir transação');
    },
  });

  const importTransactions = useMutation({
    mutationFn: async (transactions: Array<{
      date: string;
      description: string;
      amount: number;
      kind: TransactionKind;
      category_id?: string | null;
      external_hash: string;
    }>) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('transactions')
        .insert(transactions.map(t => ({ ...t, user_id: user.id, source: 'import' as const })))
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-summary'] });
      toast.success(`${data.length} transações importadas`);
    },
    onError: () => {
      toast.error('Erro ao importar transações');
    },
  });

  return {
    transactions,
    isLoading,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    importTransactions,
  };
}
