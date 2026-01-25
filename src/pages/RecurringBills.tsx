import { useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RecurringBillForm } from '@/components/recurring-bills/RecurringBillForm';
import { useRecurringBills } from '@/hooks/useRecurringBills';
import { useCategories } from '@/hooks/useCategories';
import { RecurringBill } from '@/types/finance';
import { formatCurrency } from '@/lib/format';

export default function RecurringBills() {
  const { recurringBills, createRecurringBill, updateRecurringBill, deleteRecurringBill } = useRecurringBills();
  const { categories } = useCategories();
  const [formOpen, setFormOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<RecurringBill | null>(null);

  const handleSubmit = (data: any) => {
    if (editingBill) {
      updateRecurringBill.mutate({ id: editingBill.id, ...data });
    } else {
      createRecurringBill.mutate(data);
    }
    setFormOpen(false);
    setEditingBill(null);
  };

  const totalFixed = recurringBills.reduce((sum, b) => sum + Number(b.amount), 0);

  return (
    <AppLayout title="Custos Fixos">
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            Total mensal: <span className="font-semibold text-foreground">{formatCurrency(totalFixed)}</span>
          </p>
          <Button onClick={() => { setEditingBill(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Novo Custo Fixo
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recurringBills.map((bill) => (
            <Card key={bill.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium">{bill.name}</CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingBill(bill); setFormOpen(true); }}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-expense" onClick={() => deleteRecurringBill.mutate(bill.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">{formatCurrency(Number(bill.amount))}</p>
                <p className="text-sm text-muted-foreground">Vencimento: dia {bill.due_day}</p>
                {bill.category && <p className="text-sm text-muted-foreground">{bill.category.name}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        <RecurringBillForm open={formOpen} onOpenChange={setFormOpen} onSubmit={handleSubmit} categories={categories} bill={editingBill} />
      </div>
    </AppLayout>
  );
}
