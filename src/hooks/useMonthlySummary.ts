import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MonthlySummary, CategoryBreakdown } from '@/types/finance';
import { getMonthEnd } from '@/lib/format';

export function useMonthlySummary(monthRef: string) {
  const { user } = useAuth();

  const monthStart = monthRef;
  const monthEnd = getMonthEnd(new Date(monthRef + 'T12:00:00')).toISOString().split('T')[0];

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['monthly-summary', user?.id, monthRef],
    queryFn: async (): Promise<MonthlySummary> => {
      if (!user) {
        return {
          totalIncome: 0,
          fixedIncome: 0,
          variableIncome: 0,
          totalExpenses: 0,
          fixedExpenses: 0,
          variableExpenses: 0,
          totalInvestments: 0,
          balance: 0,
          projectedBalance: 0,
        };
      }

      // Fetch transactions
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('amount, kind, status')
        .eq('user_id', user.id)
        .gte('date', monthStart)
        .lte('date', monthEnd);

      if (error) throw error;

      // Fetch pending bill instances for projection
      const { data: pendingBills, error: billsError } = await supabase
        .from('bill_instances')
        .select('amount')
        .eq('user_id', user.id)
        .eq('month_ref', monthRef)
        .eq('status', 'pending');

      if (billsError) throw billsError;

      const result: MonthlySummary = {
        totalIncome: 0,
        fixedIncome: 0,
        variableIncome: 0,
        totalExpenses: 0,
        fixedExpenses: 0,
        variableExpenses: 0,
        totalInvestments: 0,
        balance: 0,
        projectedBalance: 0,
      };

      transactions?.forEach(t => {
        const amount = Number(t.amount);
        if (t.kind === 'income') {
          result.totalIncome += amount;
          // For income, we consider all paid transactions as "fixed" for simplicity
          // You can enhance this logic based on your needs
          if (t.status === 'paid') {
            result.fixedIncome += amount;
          } else {
            result.variableIncome += amount;
          }
        } else if (t.kind === 'investment') {
          result.totalInvestments += Math.abs(amount);
        } else {
          // Expenses (fixed or variable)
          const expenseAmount = Math.abs(amount);
          result.totalExpenses += expenseAmount;
          if (t.kind === 'fixed') {
            result.fixedExpenses += expenseAmount;
          } else {
            result.variableExpenses += expenseAmount;
          }
        }
      });

      result.balance = result.totalIncome - result.totalExpenses - result.totalInvestments;

      // Projected balance = current balance - pending bills
      const pendingBillsTotal = pendingBills?.reduce((sum, b) => sum + Number(b.amount), 0) || 0;
      result.projectedBalance = result.balance - pendingBillsTotal;

      return result;
    },
    enabled: !!user,
  });

  const { data: categoryBreakdown = [], isLoading: breakdownLoading } = useQuery({
    queryKey: ['category-breakdown', user?.id, monthRef],
    queryFn: async (): Promise<CategoryBreakdown[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('transactions')
        .select('amount, category:categories(id, name, color)')
        .eq('user_id', user.id)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .lt('amount', 0); // Only expenses

      if (error) throw error;

      const breakdown: Record<string, CategoryBreakdown> = {};

      data?.forEach(t => {
        const categoryId = t.category?.id || 'uncategorized';
        const categoryName = t.category?.name || 'Sem categoria';
        const categoryColor = t.category?.color || '#6B7280';

        if (!breakdown[categoryId]) {
          breakdown[categoryId] = {
            categoryId: categoryId === 'uncategorized' ? null : categoryId,
            categoryName,
            categoryColor,
            total: 0,
            count: 0,
          };
        }

        breakdown[categoryId].total += Math.abs(Number(t.amount));
        breakdown[categoryId].count += 1;
      });

      return Object.values(breakdown).sort((a, b) => b.total - a.total);
    },
    enabled: !!user,
  });

  return {
    summary: summary || {
      totalIncome: 0,
      fixedIncome: 0,
      variableIncome: 0,
      totalExpenses: 0,
      fixedExpenses: 0,
      variableExpenses: 0,
      totalInvestments: 0,
      balance: 0,
      projectedBalance: 0,
    },
    categoryBreakdown,
    isLoading: summaryLoading || breakdownLoading,
  };
}
