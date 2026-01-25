import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { MonthlySummary } from '@/types/finance';
import { cn } from '@/lib/utils';

interface ProjectionCardProps {
  summary: MonthlySummary;
}

export function ProjectionCard({ summary }: ProjectionCardProps) {
  const isPositive = summary.projectedBalance >= 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Projeção do Mês</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Receita (Fixo)</p>
            <p className="text-lg font-semibold tabular-nums text-income">
              {formatCurrency(summary.fixedIncome)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Receita (Variável)</p>
            <p className="text-lg font-semibold tabular-nums text-income">
              {formatCurrency(summary.variableIncome)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Gastos (Fixo)</p>
            <p className="text-lg font-semibold tabular-nums text-expense">
              {formatCurrency(summary.fixedExpenses)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Gastos (Variável)</p>
            <p className="text-lg font-semibold tabular-nums text-expense">
              {formatCurrency(summary.variableExpenses)}
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Investimentos</p>
          <p className="text-lg font-semibold tabular-nums text-investment">
            {formatCurrency(summary.totalInvestments)}
          </p>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Balanço Projetado</p>
              <p className="text-sm text-muted-foreground">
                (considerando custos fixos pendentes)
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isPositive ? (
                <TrendingUp className="h-5 w-5 text-income" />
              ) : (
                <TrendingDown className="h-5 w-5 text-expense" />
              )}
              <span
                className={cn(
                  'text-2xl font-bold tabular-nums',
                  isPositive ? 'text-income' : 'text-expense'
                )}
              >
                {formatCurrency(summary.projectedBalance)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
