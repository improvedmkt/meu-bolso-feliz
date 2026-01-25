import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Category, Transaction, TransactionKind, TransactionStatus } from '@/types/finance';
import { formatDateInput } from '@/lib/format';

const transactionSchema = z.object({
  date: z.string().min(1, 'Data é obrigatória'),
  description: z.string().min(1, 'Descrição é obrigatória').max(200),
  amount: z.string().min(1, 'Valor é obrigatório'),
  kind: z.enum(['fixed', 'variable', 'investment', 'income']),
  category_id: z.string().optional(),
  status: z.enum(['pending', 'paid']),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof transactionSchema>;

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    date: string;
    description: string;
    amount: number;
    kind: TransactionKind;
    category_id?: string | null;
    status: TransactionStatus;
    notes?: string | null;
  }) => void;
  categories: Category[];
  transaction?: Transaction | null;
  isLoading?: boolean;
}

export function TransactionForm({
  open,
  onOpenChange,
  onSubmit,
  categories,
  transaction,
  isLoading,
}: TransactionFormProps) {
  const isEditing = !!transaction;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      date: transaction?.date || formatDateInput(new Date()),
      description: transaction?.description || '',
      amount: transaction ? Math.abs(transaction.amount).toString() : '',
      kind: transaction?.kind || 'variable',
      category_id: transaction?.category_id || '',
      status: transaction?.status || 'paid',
      notes: transaction?.notes || '',
    },
  });

  const kind = watch('kind');

  const handleFormSubmit = (data: FormData) => {
    const amount = parseFloat(data.amount.replace(',', '.'));
    // Expenses are negative, income is positive
    const finalAmount = data.kind === 'income' ? Math.abs(amount) : -Math.abs(amount);
    
    onSubmit({
      date: data.date,
      description: data.description,
      amount: finalAmount,
      kind: data.kind,
      category_id: data.category_id || null,
      status: data.status,
      notes: data.notes || null,
    });

    if (!isEditing) {
      reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Transação' : 'Nova Transação'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                {...register('date')}
              />
              {errors.date && (
                <p className="text-xs text-expense">{errors.date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                {...register('amount')}
              />
              {errors.amount && (
                <p className="text-xs text-expense">{errors.amount.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder="Ex: Supermercado, Salário..."
              {...register('description')}
            />
            {errors.description && (
              <p className="text-xs text-expense">{errors.description.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="kind">Tipo</Label>
              <Select
                value={kind}
                onValueChange={(value) => setValue('kind', value as TransactionKind)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="fixed">Gasto Fixo</SelectItem>
                  <SelectItem value="variable">Gasto Variável</SelectItem>
                  <SelectItem value="investment">Investimento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Select
                value={watch('category_id') || ''}
                onValueChange={(value) => setValue('category_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={watch('status')}
              onValueChange={(value) => setValue('status', value as TransactionStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Pago/Recebido</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Notas adicionais..."
              rows={2}
              {...register('notes')}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
