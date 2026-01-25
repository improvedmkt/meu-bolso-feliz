import { useEffect } from 'react';
import { TrendingUp, TrendingDown, PiggyBank, Wallet } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SummaryCard } from '@/components/dashboard/SummaryCard';
import { CategoryBreakdownTable } from '@/components/dashboard/CategoryBreakdownTable';
import { BillInstancesList } from '@/components/dashboard/BillInstancesList';
import { ProjectionCard } from '@/components/dashboard/ProjectionCard';
import { useMonthNavigation } from '@/hooks/useMonthNavigation';
import { useMonthlySummary } from '@/hooks/useMonthlySummary';
import { useRecurringBills, useBillInstances } from '@/hooks/useRecurringBills';

export default function Dashboard() {
  const { monthRef } = useMonthNavigation();
  const { summary, categoryBreakdown, isLoading } = useMonthlySummary(monthRef);
  const { recurringBills } = useRecurringBills();
  const { billInstances, generateBillInstances, updateBillInstance } = useBillInstances(monthRef);

  // Generate bill instances for current month
  useEffect(() => {
    if (recurringBills.length > 0) {
      generateBillInstances.mutate({ monthRef, recurringBills });
    }
  }, [monthRef, recurringBills.length]);

  const handleMarkPaid = (id: string) => {
    updateBillInstance.mutate({ id, status: 'paid' });
  };

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6 animate-fade-in">
        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Receitas"
            value={summary.totalIncome}
            icon={TrendingUp}
            variant="income"
          />
          <SummaryCard
            title="Gastos"
            value={summary.totalExpenses}
            icon={TrendingDown}
            variant="expense"
          />
          <SummaryCard
            title="Investimentos"
            value={summary.totalInvestments}
            icon={PiggyBank}
            variant="investment"
          />
          <SummaryCard
            title="Balanço"
            value={summary.balance}
            icon={Wallet}
            variant="balance"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          <BillInstancesList
            instances={billInstances}
            onMarkPaid={handleMarkPaid}
          />
          <ProjectionCard summary={summary} />
        </div>

        {/* Category Breakdown */}
        <CategoryBreakdownTable
          breakdown={categoryBreakdown}
          totalExpenses={summary.totalExpenses}
        />
      </div>
    </AppLayout>
  );
}
