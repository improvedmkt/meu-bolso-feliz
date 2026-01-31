import { Hono } from 'https://deno.land/x/hono@v4.3.11/mod.ts';
import { cors } from 'https://deno.land/x/hono@v4.3.11/middleware.ts';

const app = new Hono();

// CORS middleware
app.use('*', cors({
  origin: '*',
  allowHeaders: ['authorization', 'x-client-info', 'apikey', 'content-type'],
}));

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  memo?: string;
  balance?: number;
  external_hash: string;
}

interface ParseResult {
  success: boolean;
  transactions: ParsedTransaction[];
  bankName?: string;
  accountNumber?: string;
  errors: string[];
}

// Generate unique hash for deduplication
function generateHash(date: string, description: string, amount: number): string {
  const normalizedDesc = description.toLowerCase().replace(/\s+/g, '-').substring(0, 50);
  return `${date}-${normalizedDesc}-${amount.toFixed(2)}`;
}

// Normalize date to YYYY-MM-DD format
function normalizeDate(dateStr: string): string | null {
  // Try multiple formats
  const patterns = [
    // YYYYMMDD (OFX format)
    { regex: /^(\d{4})(\d{2})(\d{2})/, format: (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}` },
    // YYYYMMDDHHMMSS (OFX with time)
    { regex: /^(\d{4})(\d{2})(\d{2})\d+/, format: (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}` },
    // DD/MM/YYYY or DD-MM-YYYY
    { regex: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/, format: (m: RegExpMatchArray) => `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` },
    // YYYY/MM/DD or YYYY-MM-DD
    { regex: /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/, format: (m: RegExpMatchArray) => `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}` },
    // MM/DD/YYYY (US format)
    { regex: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/, format: (m: RegExpMatchArray) => `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}` },
  ];

  for (const pattern of patterns) {
    const match = dateStr.trim().match(pattern.regex);
    if (match) {
      const formatted = pattern.format(match);
      // Validate the date
      const d = new Date(formatted);
      if (!isNaN(d.getTime())) {
        return formatted;
      }
    }
  }
  return null;
}

// Normalize amount string to number
function normalizeAmount(amountStr: string): number | null {
  if (!amountStr) return null;
  
  // Remove currency symbols and spaces
  let cleaned = amountStr.replace(/[R$€£\s]/gi, '').trim();
  
  // Detect format: Brazilian (1.234,56) vs US (1,234.56)
  const hasBrazilianFormat = /\d+\.\d{3}/.test(cleaned) || /,\d{2}$/.test(cleaned);
  
  if (hasBrazilianFormat) {
    // Brazilian format: dots are thousands, comma is decimal
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // US format: commas are thousands, dot is decimal
    cleaned = cleaned.replace(/,/g, '');
  }
  
  const amount = parseFloat(cleaned);
  return isNaN(amount) ? null : amount;
}

// Parse OFX/QFX file format
function parseOFX(content: string): ParseResult {
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];
  let bankName = '';
  let accountNumber = '';

  try {
    // Extract bank info
    const orgMatch = content.match(/<ORG>([^<]+)/i);
    if (orgMatch) bankName = orgMatch[1].trim();
    
    const acctMatch = content.match(/<ACCTID>([^<]+)/i);
    if (acctMatch) accountNumber = acctMatch[1].trim();

    // Extract all STMTTRN (statement transactions)
    const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match;

    while ((match = stmtTrnRegex.exec(content)) !== null) {
      const block = match[1];
      
      // Extract fields
      const trnTypeMatch = block.match(/<TRNTYPE>([^<\n]+)/i);
      const dtPostedMatch = block.match(/<DTPOSTED>([^<\n]+)/i);
      const trnAmtMatch = block.match(/<TRNAMT>([^<\n]+)/i);
      const nameMatch = block.match(/<NAME>([^<\n]+)/i);
      const memoMatch = block.match(/<MEMO>([^<\n]+)/i);
      const fitIdMatch = block.match(/<FITID>([^<\n]+)/i);
      const checkNumMatch = block.match(/<CHECKNUM>([^<\n]+)/i);

      const dateStr = dtPostedMatch?.[1]?.trim();
      const amountStr = trnAmtMatch?.[1]?.trim();
      const name = nameMatch?.[1]?.trim() || '';
      const memo = memoMatch?.[1]?.trim() || '';
      const fitId = fitIdMatch?.[1]?.trim() || '';

      if (!dateStr || !amountStr) {
        errors.push(`Transaction missing date or amount`);
        continue;
      }

      const date = normalizeDate(dateStr);
      if (!date) {
        errors.push(`Invalid date format: ${dateStr}`);
        continue;
      }

      const amount = normalizeAmount(amountStr);
      if (amount === null) {
        errors.push(`Invalid amount: ${amountStr}`);
        continue;
      }

      // Combine name and memo for description
      const description = [name, memo].filter(Boolean).join(' - ') || 'Sem descrição';

      // Use FITID if available, otherwise generate hash
      const external_hash = fitId || generateHash(date, description, amount);

      transactions.push({
        date,
        description: description.substring(0, 255),
        amount,
        memo,
        external_hash,
      });
    }

    // If no STMTTRN found, try older OFX format without closing tags
    if (transactions.length === 0) {
      const altRegex = /<STMTTRN>\s*<TRNTYPE>([^<\n]+)\s*<DTPOSTED>([^<\n]+)\s*<TRNAMT>([^<\n]+)\s*(?:<FITID>([^<\n]+))?\s*(?:<NAME>([^<\n]+))?\s*(?:<MEMO>([^<\n]+))?/gi;
      
      while ((match = altRegex.exec(content)) !== null) {
        const [, trnType, dateStr, amountStr, fitId, name, memo] = match;
        
        const date = normalizeDate(dateStr?.trim() || '');
        const amount = normalizeAmount(amountStr?.trim() || '');
        
        if (!date || amount === null) continue;
        
        const description = [name?.trim(), memo?.trim()].filter(Boolean).join(' - ') || 'Sem descrição';
        const external_hash = fitId?.trim() || generateHash(date, description, amount);
        
        transactions.push({
          date,
          description: description.substring(0, 255),
          amount,
          memo: memo?.trim(),
          external_hash,
        });
      }
    }

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    errors.push(`OFX parsing error: ${errorMessage}`);
  }

  return {
    success: transactions.length > 0,
    transactions,
    bankName,
    accountNumber,
    errors,
  };
}

// Bank-specific CSV configurations
interface BankConfig {
  name: string;
  dateCol: number;
  descCol: number;
  amountCol: number;
  creditCol?: number;
  debitCol?: number;
  balanceCol?: number;
  skipRows: number;
  delimiter: string;
  dateFormat: 'BR' | 'US' | 'ISO';
  invertSign?: boolean;
}

const bankConfigs: Record<string, BankConfig> = {
  nubank: {
    name: 'Nubank',
    dateCol: 0,
    descCol: 1,
    amountCol: 2,
    skipRows: 1,
    delimiter: ',',
    dateFormat: 'BR',
  },
  nubank_fatura: {
    name: 'Nubank Fatura',
    dateCol: 0,
    descCol: 2,
    amountCol: 3,
    skipRows: 1,
    delimiter: ',',
    dateFormat: 'BR',
    invertSign: true, // Fatura shows positive as expense
  },
  itau: {
    name: 'Itaú',
    dateCol: 0,
    descCol: 1,
    amountCol: 2,
    skipRows: 1,
    delimiter: ';',
    dateFormat: 'BR',
  },
  bradesco: {
    name: 'Bradesco',
    dateCol: 0,
    descCol: 2,
    amountCol: 3,
    skipRows: 4,
    delimiter: ';',
    dateFormat: 'BR',
  },
  bb: {
    name: 'Banco do Brasil',
    dateCol: 0,
    descCol: 2,
    creditCol: 4,
    debitCol: 5,
    amountCol: -1,
    skipRows: 1,
    delimiter: ',',
    dateFormat: 'BR',
  },
  santander: {
    name: 'Santander',
    dateCol: 0,
    descCol: 1,
    amountCol: 2,
    skipRows: 1,
    delimiter: ';',
    dateFormat: 'BR',
  },
  inter: {
    name: 'Banco Inter',
    dateCol: 0,
    descCol: 1,
    amountCol: 2,
    skipRows: 1,
    delimiter: ';',
    dateFormat: 'BR',
  },
  c6: {
    name: 'C6 Bank',
    dateCol: 0,
    descCol: 1,
    amountCol: 2,
    skipRows: 1,
    delimiter: ',',
    dateFormat: 'BR',
  },
  xp: {
    name: 'XP Investimentos',
    dateCol: 0,
    descCol: 1,
    amountCol: 2,
    skipRows: 1,
    delimiter: ';',
    dateFormat: 'BR',
  },
  generic: {
    name: 'Genérico',
    dateCol: 0,
    descCol: 1,
    amountCol: 2,
    skipRows: 1,
    delimiter: ',',
    dateFormat: 'BR',
  },
};

// Detect bank from CSV content
function detectBank(content: string, headers: string[]): string {
  const contentLower = content.toLowerCase();
  const headersLower = headers.join(',').toLowerCase();

  // Nubank Fatura
  if (headersLower.includes('category') && headersLower.includes('title')) {
    return 'nubank_fatura';
  }
  
  // Nubank conta
  if (contentLower.includes('nu pagamentos') || headersLower.includes('date,description,amount')) {
    return 'nubank';
  }
  
  // Itaú
  if (contentLower.includes('itau') || contentLower.includes('itaú')) {
    return 'itau';
  }
  
  // Bradesco
  if (contentLower.includes('bradesco')) {
    return 'bradesco';
  }
  
  // Banco do Brasil
  if (contentLower.includes('banco do brasil') || headersLower.includes('valor credito')) {
    return 'bb';
  }
  
  // Santander
  if (contentLower.includes('santander')) {
    return 'santander';
  }
  
  // Inter
  if (contentLower.includes('banco inter')) {
    return 'inter';
  }
  
  // C6
  if (contentLower.includes('c6 bank') || contentLower.includes('c6bank')) {
    return 'c6';
  }
  
  // XP
  if (contentLower.includes('xp investimentos')) {
    return 'xp';
  }

  return 'generic';
}

// Parse CSV with auto-detection
function parseCSV(content: string, forcedBank?: string): ParseResult {
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];

  try {
    // Normalize line endings
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedContent.trim().split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return { success: false, transactions: [], errors: ['Arquivo vazio ou sem dados'] };
    }

    // Detect delimiter
    const firstLine = lines[0];
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';

    // Parse headers
    const headers = parseCSVLine(firstLine, delimiter);
    
    // Detect bank
    const bankKey = forcedBank || detectBank(content, headers);
    const config = bankConfigs[bankKey] || bankConfigs.generic;

    // Try to auto-detect column positions from headers
    let dateCol = config.dateCol;
    let descCol = config.descCol;
    let amountCol = config.amountCol;
    let creditCol = config.creditCol;
    let debitCol = config.debitCol;

    // Smart header detection
    headers.forEach((h, i) => {
      const hLower = h.toLowerCase().trim();
      if (['data', 'date', 'dt', 'data lancamento'].includes(hLower)) dateCol = i;
      if (['descricao', 'description', 'historico', 'descrição', 'title'].includes(hLower)) descCol = i;
      if (['valor', 'amount', 'value', 'vlr'].includes(hLower)) amountCol = i;
      if (['credito', 'credit', 'entrada'].includes(hLower)) creditCol = i;
      if (['debito', 'debit', 'saida'].includes(hLower)) debitCol = i;
    });

    // Parse data rows
    for (let i = config.skipRows; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = parseCSVLine(line, delimiter);
      if (cols.length < Math.max(dateCol, descCol, amountCol) + 1) continue;

      const dateStr = cols[dateCol]?.trim();
      const description = cols[descCol]?.trim() || 'Sem descrição';
      
      // Handle amount
      let amount: number | null = null;
      
      if (creditCol !== undefined && debitCol !== undefined) {
        // Separate credit/debit columns
        const credit = normalizeAmount(cols[creditCol] || '0') || 0;
        const debit = normalizeAmount(cols[debitCol] || '0') || 0;
        amount = credit - debit;
      } else {
        amount = normalizeAmount(cols[amountCol] || '');
      }

      if (amount === null) continue;

      // Apply sign inversion if needed
      if (config.invertSign) {
        amount = -amount;
      }

      const date = normalizeDate(dateStr || '');
      if (!date) {
        errors.push(`Linha ${i + 1}: data inválida "${dateStr}"`);
        continue;
      }

      const external_hash = generateHash(date, description, amount);

      transactions.push({
        date,
        description: description.substring(0, 255),
        amount,
        external_hash,
      });
    }

    return {
      success: transactions.length > 0,
      transactions,
      bankName: config.name,
      errors,
    };

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return {
      success: false,
      transactions: [],
      errors: [`Erro ao processar CSV: ${errorMessage}`],
    };
  }
}

// Parse a CSV line handling quoted fields
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Main endpoint
app.post('/', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const bankHint = formData.get('bank') as string | null;

    if (!file) {
      return c.json({ success: false, errors: ['Nenhum arquivo enviado'] }, 400);
    }

    const content = await file.text();
    const fileName = file.name.toLowerCase();

    let result: ParseResult;

    if (fileName.endsWith('.ofx') || fileName.endsWith('.qfx')) {
      result = parseOFX(content);
    } else {
      result = parseCSV(content, bankHint || undefined);
    }

    // Sort by date descending
    result.transactions.sort((a, b) => b.date.localeCompare(a.date));

    return c.json(result);

  } catch (error) {
    console.error('Parse error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({
      success: false,
      transactions: [],
      errors: [`Erro interno: ${errorMessage}`],
    }, 500);
  }
});

// Health check
app.get('/', (c) => {
  return c.json({ status: 'ok', banks: Object.keys(bankConfigs) });
});

Deno.serve(app.fetch);
