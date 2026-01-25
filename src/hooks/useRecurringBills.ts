import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RecurringBill, BillInstance, TransactionStatus } from '@/types/finance';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useRecurringBills() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: recurringBills = [], isLoading } = useQuery({
    queryKey: ['recurring-bills', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('recurring_bills')
        .select('*, category:categories(*)')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('due_day');
      
      if (error) throw error;
      return data as RecurringBill[];
    },
    enabled: !!user,
  });

  const createRecurringBill = useMutation({
    mutationFn: async (bill: {
      name: string;
      amount: number;
      due_day: number;
      category_id?: string | null;
      match_keywords?: string | null;
      remind_days_before?: number | null;
      payment_method?: string | null;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('recurring_bills')
        .insert({ ...bill, user_id: user.id })
        .select('*, category:categories(*)')
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-bills'] });
      toast.success('Custo fixo criado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao criar custo fixo');
    },
  });

  const updateRecurringBill = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RecurringBill> & { id: string }) => {
      const { data, error } = await supabase
        .from('recurring_bills')
        .update(updates)
        .eq('id', id)
        .select('*, category:categories(*)')
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-bills'] });
      toast.success('Custo fixo atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar custo fixo');
    },
  });

  const deleteRecurringBill = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recurring_bills')
        .update({ active: false })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-bills'] });
      toast.success('Custo fixo desativado');
    },
    onError: () => {
      toast.error('Erro ao desativar custo fixo');
    },
  });

  return {
    recurringBills,
    isLoading,
    createRecurringBill,
    updateRecurringBill,
    deleteRecurringBill,
  };
}

export function useBillInstances(monthRef: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: billInstances = [], isLoading } = useQuery({
    queryKey: ['bill-instances', user?.id, monthRef],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('bill_instances')
        .select('*, recurring_bill:recurring_bills(*, category:categories(*))')
        .eq('user_id', user.id)
        .eq('month_ref', monthRef)
        .order('due_date');
      
      if (error) throw error;
      return data as BillInstance[];
    },
    enabled: !!user,
  });

  const generateBillInstances = useMutation({
    mutationFn: async ({ monthRef, recurringBills }: { monthRef: string; recurringBills: RecurringBill[] }) => {
      if (!user) throw new Error('Not authenticated');
      
      const monthDate = new Date(monthRef + 'T12:00:00');
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      
      const instances = recurringBills.map(bill => {
        // Calculate due date, handling months with fewer days
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
        const dueDay = Math.min(bill.due_day, lastDayOfMonth);
        const dueDate = new Date(year, month, dueDay);
        
        return {
          user_id: user.id,
          recurring_bill_id: bill.id,
          month_ref: monthRef,
          due_date: dueDate.toISOString().split('T')[0],
          amount: bill.amount,
          status: 'pending' as TransactionStatus,
        };
      });

      // Use upsert to avoid duplicates
      const { data, error } = await supabase
        .from('bill_instances')
        .upsert(instances, { onConflict: 'recurring_bill_id,month_ref' })
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bill-instances'] });
    },
  });

  const updateBillInstance = useMutation({
    mutationFn: async ({ id, status, paid_transaction_id }: { id: string; status: TransactionStatus; paid_transaction_id?: string | null }) => {
      const { data, error } = await supabase
        .from('bill_instances')
        .update({ status, paid_transaction_id })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bill-instances'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-summary'] });
      toast.success('Status atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });

  return {
    billInstances,
    isLoading,
    generateBillInstances,
    updateBillInstance,
  };
}
