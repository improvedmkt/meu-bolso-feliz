import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

interface SummaryCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant?: 'income' | 'expense' | 'investment' | 'balance';
  subtitle?: string;
}

export function SummaryCard({ 
  title, 
  value, 
  icon: Icon, 
  variant = 'balance',
  subtitle 
}: SummaryCardProps) {
  const isPositive = value >= 0;
  
  const iconColors = {
    income: 'bg-income/10 text-income',
    expense: 'bg-expense/10 text-expense',
    investment: 'bg-investment/10 text-investment',
    balance: isPositive ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense',
  };

  const valueColors = {
    income: 'text-income',
    expense: 'text-expense',
    investment: 'text-investment',
    balance: isPositive ? 'text-income' : 'text-expense',
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={cn('text-2xl font-bold tabular-nums', valueColors[variant])}>
              {formatCurrency(value)}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={cn('rounded-lg p-2.5', iconColors[variant])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
