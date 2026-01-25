import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Category, RecurringBill } from '@/types/finance';

const billSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  amount: z.string().min(1, 'Valor é obrigatório'),
  due_day: z.string().min(1, 'Dia de vencimento é obrigatório'),
  category_id: z.string().optional(),
  match_keywords: z.string().optional(),
  remind_days_before: z.string().optional(),
  payment_method: z.string().optional(),
});

type FormData = z.infer<typeof billSchema>;

interface RecurringBillFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    amount: number;
    due_day: number;
    category_id?: string | null;
    match_keywords?: string | null;
    remind_days_before?: number | null;
    payment_method?: string | null;
  }) => void;
  categories: Category[];
  bill?: RecurringBill | null;
  isLoading?: boolean;
}

export function RecurringBillForm({
  open,
  onOpenChange,
  onSubmit,
  categories,
  bill,
  isLoading,
}: RecurringBillFormProps) {
  const isEditing = !!bill;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      name: bill?.name || '',
      amount: bill ? bill.amount.toString() : '',
      due_day: bill ? bill.due_day.toString() : '',
      category_id: bill?.category_id || '',
      match_keywords: bill?.match_keywords || '',
      remind_days_before: bill?.remind_days_before?.toString() || '3',
      payment_method: bill?.payment_method || '',
    },
  });

  const handleFormSubmit = (data: FormData) => {
    onSubmit({
      name: data.name,
      amount: parseFloat(data.amount.replace(',', '.')),
      due_day: parseInt(data.due_day),
      category_id: data.category_id || null,
      match_keywords: data.match_keywords || null,
      remind_days_before: data.remind_days_before ? parseInt(data.remind_days_before) : null,
      payment_method: data.payment_method || null,
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
            {isEditing ? 'Editar Custo Fixo' : 'Novo Custo Fixo'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              placeholder="Ex: Aluguel, Netflix, Academia..."
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-expense">{errors.name.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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

            <div className="space-y-2">
              <Label htmlFor="due_day">Dia de Vencimento</Label>
              <Input
                id="due_day"
                type="number"
                min="1"
                max="31"
                placeholder="1-31"
                {...register('due_day')}
              />
              {errors.due_day && (
                <p className="text-xs text-expense">{errors.due_day.message}</p>
              )}
            </div>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="remind_days_before">Lembrete (dias antes)</Label>
              <Input
                id="remind_days_before"
                type="number"
                min="0"
                max="30"
                {...register('remind_days_before')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_method">Forma de Pagamento</Label>
              <Input
                id="payment_method"
                placeholder="Ex: Cartão, Boleto..."
                {...register('payment_method')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="match_keywords">Palavras-chave para conciliar</Label>
            <Input
              id="match_keywords"
              placeholder="Ex: NETFLIX, SPOTIFY (separar por vírgula)"
              {...register('match_keywords')}
            />
            <p className="text-xs text-muted-foreground">
              Usado para identificar automaticamente transações importadas
            </p>
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
