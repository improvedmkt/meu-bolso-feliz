-- Create enums
CREATE TYPE public.category_type AS ENUM ('essential', 'discretionary', 'investment', 'income');
CREATE TYPE public.transaction_kind AS ENUM ('fixed', 'variable', 'investment', 'income');
CREATE TYPE public.transaction_status AS ENUM ('pending', 'paid');
CREATE TYPE public.transaction_source AS ENUM ('manual', 'import');
CREATE TYPE public.notification_type AS ENUM ('bill_due', 'bill_overdue', 'budget_exceeded', 'info');

-- Categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type_default category_type,
  icon TEXT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own categories" ON public.categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.categories FOR DELETE USING (auth.uid() = user_id);

-- Transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  kind transaction_kind NOT NULL DEFAULT 'variable',
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  status transaction_status NOT NULL DEFAULT 'paid',
  source transaction_source NOT NULL DEFAULT 'manual',
  external_hash TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_transactions_external_hash ON public.transactions(user_id, external_hash) WHERE external_hash IS NOT NULL;

CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON public.transactions FOR DELETE USING (auth.uid() = user_id);

-- Recurring bills (custos fixos)
CREATE TABLE public.recurring_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  match_keywords TEXT,
  remind_days_before INTEGER DEFAULT 3,
  payment_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recurring_bills" ON public.recurring_bills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recurring_bills" ON public.recurring_bills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recurring_bills" ON public.recurring_bills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recurring_bills" ON public.recurring_bills FOR DELETE USING (auth.uid() = user_id);

-- Bill instances (parcelas mensais)
CREATE TABLE public.bill_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recurring_bill_id UUID NOT NULL REFERENCES public.recurring_bills(id) ON DELETE CASCADE,
  month_ref DATE NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status transaction_status NOT NULL DEFAULT 'pending',
  paid_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bill_instances ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_bill_instances_unique ON public.bill_instances(recurring_bill_id, month_ref);

CREATE POLICY "Users can view own bill_instances" ON public.bill_instances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bill_instances" ON public.bill_instances FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bill_instances" ON public.bill_instances FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bill_instances" ON public.bill_instances FOR DELETE USING (auth.uid() = user_id);

-- Budgets (limites por categoria)
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_ref DATE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  limit_amount NUMERIC(12,2),
  limit_percent NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_budgets_unique ON public.budgets(user_id, month_ref, category_id);

CREATE POLICY "Users can view own budgets" ON public.budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own budgets" ON public.budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budgets" ON public.budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budgets" ON public.budgets FOR DELETE USING (auth.uid() = user_id);

-- Notifications (in-app)
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  related_bill_id UUID REFERENCES public.recurring_bills(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- Function to create default categories for new users
CREATE OR REPLACE FUNCTION public.create_default_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.categories (user_id, name, type_default, icon, color) VALUES
    (NEW.id, 'Moradia', 'essential', 'Home', '#3B82F6'),
    (NEW.id, 'Luz', 'essential', 'Zap', '#F59E0B'),
    (NEW.id, 'Alimentação', 'essential', 'UtensilsCrossed', '#10B981'),
    (NEW.id, 'Academia', 'discretionary', 'Dumbbell', '#8B5CF6'),
    (NEW.id, 'Gasolina', 'essential', 'Fuel', '#EF4444'),
    (NEW.id, 'Seguro', 'essential', 'Shield', '#6366F1'),
    (NEW.id, 'Servidores', 'essential', 'Server', '#14B8A6'),
    (NEW.id, 'Contabilidade', 'essential', 'Calculator', '#F97316'),
    (NEW.id, 'DAS', 'essential', 'FileText', '#EC4899'),
    (NEW.id, 'Transporte', 'essential', 'Car', '#0EA5E9'),
    (NEW.id, 'Saúde', 'essential', 'Heart', '#EF4444'),
    (NEW.id, 'Bens de consumo', 'discretionary', 'ShoppingBag', '#A855F7'),
    (NEW.id, 'Vestuário', 'discretionary', 'Shirt', '#F472B6'),
    (NEW.id, 'Educação', 'discretionary', 'GraduationCap', '#0D9488'),
    (NEW.id, 'Bem-estar & Beleza', 'discretionary', 'Sparkles', '#D946EF'),
    (NEW.id, 'Investimentos', 'investment', 'TrendingUp', '#22C55E'),
    (NEW.id, 'Receita', 'income', 'Wallet', '#10B981'),
    (NEW.id, 'Taxas e impostos', 'essential', 'Receipt', '#64748B');
  RETURN NEW;
END;
$$;

-- Trigger to create default categories on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_categories();