import { Check, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/format';
import { BillInstance } from '@/types/finance';
import { cn } from '@/lib/utils';

interface BillInstancesListProps {
  instances: BillInstance[];
  onMarkPaid: (id: string) => void;
  isLoading?: boolean;
}

export function BillInstancesList({ instances, onMarkPaid, isLoading }: BillInstancesListProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getStatus = (instance: BillInstance) => {
    if (instance.status === 'paid') return 'paid';
    const dueDate = new Date(instance.due_date + 'T12:00:00');
    if (dueDate < today) return 'overdue';
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilDue <= 3) return 'due-soon';
    return 'pending';
  };

  const totalPending = instances
    .filter(i => i.status === 'pending')
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const totalPaid = instances
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + Number(i.amount), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Custos Fixos do Mês</CardTitle>
          <div className="flex gap-4 text-sm">
            <span className="text-muted-foreground">
              Pago: <span className="font-medium text-income">{formatCurrency(totalPaid)}</span>
            </span>
            <span className="text-muted-foreground">
              Pendente: <span className="font-medium text-warning">{formatCurrency(totalPending)}</span>
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[400px] overflow-y-auto">
          {instances.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhum custo fixo cadastrado
            </div>
          ) : (
            <div className="divide-y">
              {instances.map((instance) => {
                const status = getStatus(instance);
                const recurringBill = instance.recurring_bill;
                
                return (
                  <div
                    key={instance.id}
                    className="flex items-center justify-between px-6 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full',
                          status === 'paid' && 'bg-income/10 text-income',
                          status === 'overdue' && 'bg-expense/10 text-expense',
                          status === 'due-soon' && 'bg-warning/10 text-warning',
                          status === 'pending' && 'bg-muted text-muted-foreground'
                        )}
                      >
                        {status === 'paid' ? (
                          <Check className="h-4 w-4" />
                        ) : status === 'overdue' ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : (
                          <Clock className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{recurringBill?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Vencimento: {formatDate(instance.due_date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium tabular-nums">
                        {formatCurrency(Number(instance.amount))}
                      </span>
                      {instance.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => onMarkPaid(instance.id)}
                        >
                          Marcar Pago
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
