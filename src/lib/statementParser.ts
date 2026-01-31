import { supabase } from '@/integrations/supabase/client';

export interface ParsedTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  memo?: string;
  external_hash: string;
  kind: 'income' | 'fixed' | 'variable' | 'investment';
  category_id: string | null;
  isDuplicate: boolean;
  selected: boolean;
  suggestedCategory?: string;
}

export interface ParseResult {
  success: boolean;
  transactions: ParsedTransaction[];
  bankName?: string;
  accountNumber?: string;
  errors: string[];
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export async function parseStatementFile(
  file: File,
  bankHint?: string
): Promise<ParseResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (bankHint) {
    formData.append('bank', bankHint);
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/parse-statement`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token || ''}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.errors?.[0] || `Erro HTTP ${response.status}`);
    }

    const result = await response.json();
    
    // Transform to our format with UI state
    const transactions: ParsedTransaction[] = result.transactions.map((t: any, index: number) => ({
      id: `import-${index}-${Date.now()}`,
      date: t.date,
      description: t.description,
      amount: t.amount,
      memo: t.memo,
      external_hash: t.external_hash,
      kind: t.amount > 0 ? 'income' : 'variable',
      category_id: null,
      isDuplicate: false,
      selected: true,
    }));

    return {
      success: result.success,
      transactions,
      bankName: result.bankName,
      accountNumber: result.accountNumber,
      errors: result.errors || [],
    };
  } catch (error) {
    console.error('Parse error:', error);
    return {
      success: false,
      transactions: [],
      errors: [error instanceof Error ? error.message : 'Erro ao processar arquivo'],
    };
  }
}

// Category keyword matching for auto-categorization
export interface CategoryKeyword {
  categoryId: string;
  categoryName: string;
  keywords: string[];
}

export function autoCategorizeTransactions(
  transactions: ParsedTransaction[],
  categoryKeywords: CategoryKeyword[]
): ParsedTransaction[] {
  return transactions.map(transaction => {
    const descLower = transaction.description.toLowerCase();
    
    for (const catKeyword of categoryKeywords) {
      for (const keyword of catKeyword.keywords) {
        if (descLower.includes(keyword.toLowerCase())) {
          return {
            ...transaction,
            category_id: catKeyword.categoryId,
            suggestedCategory: catKeyword.categoryName,
          };
        }
      }
    }
    
    return transaction;
  });
}

// Check for duplicates against existing transactions
export function markDuplicates(
  parsed: ParsedTransaction[],
  existingHashes: Set<string>
): ParsedTransaction[] {
  return parsed.map(t => ({
    ...t,
    isDuplicate: existingHashes.has(t.external_hash),
    selected: !existingHashes.has(t.external_hash),
  }));
}

// Supported banks for dropdown
export const SUPPORTED_BANKS = [
  { value: 'auto', label: 'Detectar automaticamente' },
  { value: 'nubank', label: 'Nubank (Conta)' },
  { value: 'nubank_fatura', label: 'Nubank (Fatura do Cartão)' },
  { value: 'itau', label: 'Itaú' },
  { value: 'bradesco', label: 'Bradesco' },
  { value: 'bb', label: 'Banco do Brasil' },
  { value: 'santander', label: 'Santander' },
  { value: 'inter', label: 'Banco Inter' },
  { value: 'c6', label: 'C6 Bank' },
  { value: 'xp', label: 'XP Investimentos' },
  { value: 'generic', label: 'Genérico (CSV)' },
];
