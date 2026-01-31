const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
  const patterns = [
    { regex: /^(\d{4})(\d{2})(\d{2})/, format: (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}` },
    { regex: /^(\d{4})(\d{2})(\d{2})\d+/, format: (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}` },
    { regex: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/, format: (m: RegExpMatchArray) => `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` },
    { regex: /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/, format: (m: RegExpMatchArray) => `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}` },
  ];

  for (const pattern of patterns) {
    const match = dateStr.trim().match(pattern.regex);
    if (match) {
      const formatted = pattern.format(match);
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
  
  let cleaned = amountStr.replace(/[R$€£\s]/gi, '').trim();
  const hasBrazilianFormat = /\d+\.\d{3}/.test(cleaned) || /,\d{2}$/.test(cleaned);
  
  if (hasBrazilianFormat) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
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
    const orgMatch = content.match(/<ORG>([^<]+)/i);
    if (orgMatch) bankName = orgMatch[1].trim();
    
    const acctMatch = content.match(/<ACCTID>([^<]+)/i);
    if (acctMatch) accountNumber = acctMatch[1].trim();

    const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match;

    while ((match = stmtTrnRegex.exec(content)) !== null) {
      const block = match[1];
      
      const dtPostedMatch = block.match(/<DTPOSTED>([^<\n]+)/i);
      const trnAmtMatch = block.match(/<TRNAMT>([^<\n]+)/i);
      const nameMatch = block.match(/<NAME>([^<\n]+)/i);
      const memoMatch = block.match(/<MEMO>([^<\n]+)/i);
      const fitIdMatch = block.match(/<FITID>([^<\n]+)/i);

      const dateStr = dtPostedMatch?.[1]?.trim();
      const amountStr = trnAmtMatch?.[1]?.trim();
      const name = nameMatch?.[1]?.trim() || '';
      const memo = memoMatch?.[1]?.trim() || '';
      const fitId = fitIdMatch?.[1]?.trim() || '';

      if (!dateStr || !amountStr) continue;

      const date = normalizeDate(dateStr);
      if (!date) continue;

      const amount = normalizeAmount(amountStr);
      if (amount === null) continue;

      const description = [name, memo].filter(Boolean).join(' - ') || 'Sem descrição';
      const external_hash = fitId || generateHash(date, description, amount);

      transactions.push({
        date,
        description: description.substring(0, 255),
        amount,
        memo,
        external_hash,
      });
    }

    // Try older OFX format without closing tags
    if (transactions.length === 0) {
      const altRegex = /<STMTTRN>\s*<TRNTYPE>([^<\n]+)\s*<DTPOSTED>([^<\n]+)\s*<TRNAMT>([^<\n]+)\s*(?:<FITID>([^<\n]+))?\s*(?:<NAME>([^<\n]+))?\s*(?:<MEMO>([^<\n]+))?/gi;
      
      while ((match = altRegex.exec(content)) !== null) {
        const [, , dateStr, amountStr, fitId, name, memo] = match;
        
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

  return { success: transactions.length > 0, transactions, bankName, accountNumber, errors };
}

interface BankConfig {
  name: string;
  dateCol: number;
  descCol: number;
  amountCol: number;
  creditCol?: number;
  debitCol?: number;
  skipRows: number;
  delimiter: string;
  invertSign?: boolean;
}

const bankConfigs: Record<string, BankConfig> = {
  nubank: { name: 'Nubank', dateCol: 0, descCol: 1, amountCol: 2, skipRows: 1, delimiter: ',' },
  nubank_fatura: { name: 'Nubank Fatura', dateCol: 0, descCol: 2, amountCol: 3, skipRows: 1, delimiter: ',', invertSign: true },
  itau: { name: 'Itaú', dateCol: 0, descCol: 1, amountCol: 2, skipRows: 1, delimiter: ';' },
  bradesco: { name: 'Bradesco', dateCol: 0, descCol: 2, amountCol: 3, skipRows: 4, delimiter: ';' },
  bb: { name: 'Banco do Brasil', dateCol: 0, descCol: 2, creditCol: 4, debitCol: 5, amountCol: -1, skipRows: 1, delimiter: ',' },
  santander: { name: 'Santander', dateCol: 0, descCol: 1, amountCol: 2, skipRows: 1, delimiter: ';' },
  inter: { name: 'Banco Inter', dateCol: 0, descCol: 1, amountCol: 2, skipRows: 1, delimiter: ';' },
  c6: { name: 'C6 Bank', dateCol: 0, descCol: 1, amountCol: 2, skipRows: 1, delimiter: ',' },
  xp: { name: 'XP Investimentos', dateCol: 0, descCol: 1, amountCol: 2, skipRows: 1, delimiter: ';' },
  generic: { name: 'Genérico', dateCol: 0, descCol: 1, amountCol: 2, skipRows: 1, delimiter: ',' },
};

function detectBank(content: string, headers: string[]): string {
  const contentLower = content.toLowerCase();
  const headersLower = headers.join(',').toLowerCase();

  if (headersLower.includes('category') && headersLower.includes('title')) return 'nubank_fatura';
  if (contentLower.includes('nu pagamentos') || headersLower.includes('date,description,amount')) return 'nubank';
  if (contentLower.includes('itau') || contentLower.includes('itaú')) return 'itau';
  if (contentLower.includes('bradesco')) return 'bradesco';
  if (contentLower.includes('banco do brasil') || headersLower.includes('valor credito')) return 'bb';
  if (contentLower.includes('santander')) return 'santander';
  if (contentLower.includes('banco inter')) return 'inter';
  if (contentLower.includes('c6 bank') || contentLower.includes('c6bank')) return 'c6';
  if (contentLower.includes('xp investimentos')) return 'xp';

  return 'generic';
}

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

function parseCSV(content: string, forcedBank?: string): ParseResult {
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];

  try {
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedContent.trim().split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return { success: false, transactions: [], errors: ['Arquivo vazio ou sem dados'] };
    }

    const firstLine = lines[0];
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';

    const headers = parseCSVLine(firstLine, delimiter);
    const bankKey = forcedBank || detectBank(content, headers);
    const config = bankConfigs[bankKey] || bankConfigs.generic;

    let dateCol = config.dateCol;
    let descCol = config.descCol;
    let amountCol = config.amountCol;
    let creditCol = config.creditCol;
    let debitCol = config.debitCol;

    headers.forEach((h, i) => {
      const hLower = h.toLowerCase().trim();
      if (['data', 'date', 'dt', 'data lancamento'].includes(hLower)) dateCol = i;
      if (['descricao', 'description', 'historico', 'descrição', 'title'].includes(hLower)) descCol = i;
      if (['valor', 'amount', 'value', 'vlr'].includes(hLower)) amountCol = i;
      if (['credito', 'credit', 'entrada'].includes(hLower)) creditCol = i;
      if (['debito', 'debit', 'saida'].includes(hLower)) debitCol = i;
    });

    for (let i = config.skipRows; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = parseCSVLine(line, delimiter);
      if (cols.length < Math.max(dateCol, descCol, amountCol) + 1) continue;

      const dateStr = cols[dateCol]?.trim();
      const description = cols[descCol]?.trim() || 'Sem descrição';
      
      let amount: number | null = null;
      
      if (creditCol !== undefined && debitCol !== undefined) {
        const credit = normalizeAmount(cols[creditCol] || '0') || 0;
        const debit = normalizeAmount(cols[debitCol] || '0') || 0;
        amount = credit - debit;
      } else {
        amount = normalizeAmount(cols[amountCol] || '');
      }

      if (amount === null) continue;
      if (config.invertSign) amount = -amount;

      const date = normalizeDate(dateStr || '');
      if (!date) {
        errors.push(`Linha ${i + 1}: data inválida "${dateStr}"`);
        continue;
      }

      const external_hash = generateHash(date, description, amount);
      transactions.push({ date, description: description.substring(0, 255), amount, external_hash });
    }

    return { success: transactions.length > 0, transactions, bankName: config.name, errors };

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, transactions: [], errors: [`Erro ao processar CSV: ${errorMessage}`] };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Health check
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok', banks: Object.keys(bankConfigs) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Main POST handler
  if (req.method === 'POST') {
    try {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const bankHint = formData.get('bank') as string | null;

      if (!file) {
        return new Response(JSON.stringify({ success: false, errors: ['Nenhum arquivo enviado'] }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const content = await file.text();
      const fileName = file.name.toLowerCase();

      let result: ParseResult;

      if (fileName.endsWith('.ofx') || fileName.endsWith('.qfx')) {
        result = parseOFX(content);
      } else {
        result = parseCSV(content, bankHint || undefined);
      }

      result.transactions.sort((a, b) => b.date.localeCompare(a.date));

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error('Parse error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ success: false, transactions: [], errors: [`Erro interno: ${errorMessage}`] }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
