import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatPercent } from '@/lib/format';
import { CategoryBreakdown } from '@/types/finance';
import { cn } from '@/lib/utils';

interface CategoryBreakdownTableProps {
  breakdown: CategoryBreakdown[];
  totalExpenses: number;
}

export function CategoryBreakdownTable({ breakdown, totalExpenses }: CategoryBreakdownTableProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Gastos por Categoria</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="px-6 py-3">Categoria</th>
                <th className="px-6 py-3 text-right">Transações</th>
                <th className="px-6 py-3 text-right">Total</th>
                <th className="px-6 py-3 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum gasto neste mês
                  </td>
                </tr>
              ) : (
                breakdown.map((item) => {
                  const percentage = totalExpenses > 0 
                    ? (item.total / totalExpenses) * 100 
                    : 0;
                  
                  return (
                    <tr key={item.categoryId || 'uncategorized'} className="border-b last:border-0">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: item.categoryColor || '#6B7280' }}
                          />
                          <span className="text-sm font-medium">{item.categoryName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right text-sm text-muted-foreground">
                        {item.count}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className="text-sm font-medium tabular-nums text-expense">
                          {formatCurrency(item.total)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-expense"
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                          <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                            {formatPercent(percentage)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
