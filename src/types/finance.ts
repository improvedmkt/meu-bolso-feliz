export type CategoryType = 'essential' | 'discretionary' | 'investment' | 'income';
export type TransactionKind = 'fixed' | 'variable' | 'investment' | 'income';
export type TransactionStatus = 'pending' | 'paid';
export type TransactionSource = 'manual' | 'import';
export type NotificationType = 'bill_due' | 'bill_overdue' | 'budget_exceeded' | 'info';

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type_default: CategoryType | null;
  icon: string | null;
  color: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  date: string;
  description: string;
  amount: number;
  kind: TransactionKind;
  category_id: string | null;
  status: TransactionStatus;
  source: TransactionSource;
  external_hash: string | null;
  notes: string | null;
  created_at: string;
  // Joined
  category?: Category;
}

export interface RecurringBill {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  due_day: number;
  category_id: string | null;
  active: boolean;
  match_keywords: string | null;
  remind_days_before: number | null;
  payment_method: string | null;
  created_at: string;
  // Joined
  category?: Category;
}

export interface BillInstance {
  id: string;
  user_id: string;
  recurring_bill_id: string;
  month_ref: string;
  due_date: string;
  amount: number;
  status: TransactionStatus;
  paid_transaction_id: string | null;
  created_at: string;
  // Joined
  recurring_bill?: RecurringBill;
}

export interface Budget {
  id: string;
  user_id: string;
  month_ref: string;
  category_id: string | null;
  limit_amount: number | null;
  limit_percent: number | null;
  created_at: string;
  // Joined
  category?: Category;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  related_bill_id: string | null;
  created_at: string;
}

// Summary types
export interface MonthlySummary {
  totalIncome: number;
  fixedIncome: number;
  variableIncome: number;
  totalExpenses: number;
  fixedExpenses: number;
  variableExpenses: number;
  totalInvestments: number;
  balance: number;
  projectedBalance: number;
}

export interface CategoryBreakdown {
  categoryId: string | null;
  categoryName: string;
  categoryColor: string | null;
  total: number;
  count: number;
}
