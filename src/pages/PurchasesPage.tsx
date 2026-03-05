import { useMemo } from 'react';
import { useData } from '@/hooks/useSheetData';
import { KPICard } from '@/components/KPICard';
import { ShoppingCart, AlertTriangle, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function PurchasesPage() {
  const { inventory, sales, marketplace } = useData();

  // Calculate 7-day projected demand
  const purchaseNeeds = useMemo(() => {
    const avgDailyMap = new Map<string, number>();
    const dateSet = new Set(sales.map(s => s.Fecha));
    const totalDays = dateSet.size || 1;

    sales.forEach(s => {
      avgDailyMap.set(s.SKU, (avgDailyMap.get(s.SKU) || 0) + s.Cantidad);
    });

    return inventory.map(item => {
      const totalSold = avgDailyMap.get(item.SKU) || 0;
      const avgDaily = totalSold / totalDays;
      const demand7d = Math.ceil(avgDaily * 7);
      const deficit = Math.max(0, demand7d - item.Stock);
      const margin = item.PrecioVenta > 0 ? ((item.PrecioVenta - item.PrecioCompra) / item.PrecioVenta) * 100 : 0;

      return {
        SKU: item.SKU,
        Producto: item.Producto,
        Stock: item.Stock,
        avgDaily: Math.round(avgDaily * 10) / 10,
        demand7d,
        deficit,
        PrecioCompra: item.PrecioCompra,
        costToRestock: deficit * item.PrecioCompra,
        margin: Math.round(margin),
        needsReorder: item.Stock <= item.PuntoReorden,
        Marketplace: item.Marketplace,
      };
    }).sort((a, b) => b.deficit - a.deficit);
  }, [inventory, sales]);

  // Margin comparison by channel
  const marginByChannel = useMemo(() => {
    const skuMap = new Map<string, { shein: number; tiktok: number; name: string }>();
    inventory.forEach(item => {
      const margin = ((item.PrecioVenta - item.PrecioCompra) / item.PrecioVenta) * 100;
      const existing = skuMap.get(item.SKU) || { shein: 0, tiktok: 0, name: item.Producto };
      if (item.Marketplace === 'SHEIN') existing.shein = Math.round(margin);
      if (item.Marketplace === 'TIKTOK') existing.tiktok = Math.round(margin);
      skuMap.set(item.SKU, existing);
    });
    return Array.from(skuMap.entries()).map(([sku, data]) => ({ sku, ...data })).slice(0, 10);
  }, [inventory]);

  const totalDeficit = purchaseNeeds.reduce((s, p) => s + p.deficit, 0);
  const totalCost = purchaseNeeds.reduce((s, p) => s + p.costToRestock, 0);
  const urgentItems = purchaseNeeds.filter(p => p.needsReorder).length;
  const fmt = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Planificación de Compras</h2>
        <p className="text-xs text-muted-foreground">{marketplace} — Proyección a 7 días</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard title="Unidades a Comprar" value={totalDeficit} icon={<ShoppingCart className="w-4 h-4" />} />
        <KPICard title="Inversión Estimada" value={fmt(totalCost)} icon={<TrendingUp className="w-4 h-4" />} />
        <KPICard title="Items Urgentes" value={urgentItems} icon={<AlertTriangle className="w-4 h-4" />} status={urgentItems > 3 ? 'destructive' : urgentItems > 0 ? 'warning' : 'success'} />
      </div>

      {/* Purchase needs table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Necesidad de Compra (7 días)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Producto</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Stock</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Vta/Día</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Demanda 7d</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Déficit</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Costo</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Estado</th>
              </tr>
            </thead>
            <tbody>
              {purchaseNeeds.map(item => (
                <tr key={item.SKU + item.Marketplace} className="border-b border-border hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-primary">{item.SKU}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{item.Producto}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{item.Stock}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{item.avgDaily}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{item.demand7d}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    <span className={item.deficit > 0 ? 'text-destructive font-bold' : 'text-success'}>{item.deficit}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{fmt(item.costToRestock)}</td>
                  <td className="px-4 py-3 text-center">
                    {item.needsReorder ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                        <AlertTriangle className="w-3 h-3" /> Urgente
                      </span>
                    ) : item.deficit > 0 ? (
                      <span className="text-xs text-warning">Planificar</span>
                    ) : (
                      <span className="text-xs text-success">✓ OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Margin comparison chart */}
      {marketplace === 'COMBINADO' && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Comparativo de Márgenes por Canal</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={marginByChannel} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                <XAxis type="number" fontSize={10} stroke="hsl(215, 12%, 50%)" unit="%" />
                <YAxis dataKey="name" type="category" fontSize={10} stroke="hsl(215, 12%, 50%)" width={100} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(220, 18%, 12%)', border: '1px solid hsl(220, 15%, 18%)', borderRadius: '8px', fontSize: '12px', color: 'hsl(210, 20%, 92%)' }} />
                <Legend />
                <Bar dataKey="shein" name="SHEIN" fill="hsl(175, 80%, 45%)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="tiktok" name="TIKTOK" fill="hsl(260, 60%, 55%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
