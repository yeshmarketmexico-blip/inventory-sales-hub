import { useMemo } from 'react';
import { useData } from '@/hooks/useSheetData';
import { KPICard } from '@/components/KPICard';
import { DollarSign, TrendingUp, ShoppingBag, BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart, Area,
} from 'recharts';

export default function SalesPage() {
  const { sales, inventory, marketplace } = useData();

  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((s, sale) => s + sale.Total, 0);
    const totalUnits = sales.reduce((s, sale) => s + sale.Cantidad, 0);
    const dateSet = new Set(sales.map(s => s.Fecha));
    const days = dateSet.size || 1;
    const dailyAvg = totalRevenue / days;
    const totalCost = sales.reduce((sum, s) => {
      const inv = inventory.find(i => i.SKU === s.SKU);
      return sum + s.Cantidad * (inv?.PrecioCompra || 0);
    }, 0);
    const profit = totalRevenue - totalCost;
    return { totalRevenue, totalUnits, dailyAvg, profit, days };
  }, [sales, inventory]);

  // Pareto analysis
  const paretoData = useMemo(() => {
    const productMap = new Map<string, { name: string; revenue: number }>();
    sales.forEach(s => {
      const existing = productMap.get(s.SKU) || { name: s.Producto, revenue: 0 };
      existing.revenue += s.Total;
      productMap.set(s.SKU, existing);
    });
    const sorted = Array.from(productMap.entries())
      .map(([sku, d]) => ({ sku, name: d.name, revenue: Math.round(d.revenue) }))
      .sort((a, b) => b.revenue - a.revenue);

    const totalRev = sorted.reduce((s, p) => s + p.revenue, 0);
    let cumulative = 0;
    return sorted.map(p => {
      cumulative += p.revenue;
      return { ...p, cumPct: Math.round((cumulative / totalRev) * 100) };
    });
  }, [sales]);

  // Daily sales by marketplace (for stacked bar)
  const dailyByMarketplace = useMemo(() => {
    const map = new Map<string, { date: string; SHEIN: number; TIKTOK: number }>();
    // Use raw unfiltered-by-marketplace sales for stacked view
    sales.forEach(s => {
      const existing = map.get(s.Fecha) || { date: s.Fecha, SHEIN: 0, TIKTOK: 0 };
      if (s.Marketplace === 'SHEIN') existing.SHEIN += s.Total;
      else if (s.Marketplace === 'TIKTOK') existing.TIKTOK += s.Total;
      else {
        existing.SHEIN += s.Total / 2;
        existing.TIKTOK += s.Total / 2;
      }
      map.set(s.Fecha, existing);
    });
    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({ ...d, date: d.date.slice(5), SHEIN: Math.round(d.SHEIN), TIKTOK: Math.round(d.TIKTOK) }));
  }, [sales]);

  const fmt = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Desempeño de Ventas</h2>
        <p className="text-xs text-muted-foreground">{marketplace} — {stats.days} días analizados</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Ingresos Totales" value={fmt(stats.totalRevenue)} icon={<DollarSign className="w-4 h-4" />} trend={8.3} />
        <KPICard title="Ganancia Neta" value={fmt(stats.profit)} icon={<TrendingUp className="w-4 h-4" />} status={stats.profit > 0 ? 'success' : 'destructive'} />
        <KPICard title="Venta Diaria" value={fmt(stats.dailyAvg)} icon={<BarChart3 className="w-4 h-4" />} />
        <KPICard title="Unidades Vendidas" value={stats.totalUnits.toLocaleString()} icon={<ShoppingBag className="w-4 h-4" />} />
      </div>

      {/* Pareto Chart */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4">Análisis Pareto (80/20)</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={paretoData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis dataKey="name" fontSize={9} stroke="hsl(215, 12%, 50%)" angle={-30} textAnchor="end" height={60} />
              <YAxis yAxisId="left" fontSize={10} stroke="hsl(215, 12%, 50%)" />
              <YAxis yAxisId="right" orientation="right" fontSize={10} stroke="hsl(215, 12%, 50%)" unit="%" domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(220, 18%, 12%)', border: '1px solid hsl(220, 15%, 18%)', borderRadius: '8px', fontSize: '12px', color: 'hsl(210, 20%, 92%)' }} />
              <Bar yAxisId="left" dataKey="revenue" fill="hsl(175, 80%, 45%)" radius={[4, 4, 0, 0]} name="Ingresos" />
              <Line yAxisId="right" dataKey="cumPct" stroke="hsl(38, 92%, 55%)" strokeWidth={2} dot={false} name="% Acumulado" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {paretoData.filter(p => p.cumPct <= 80).length} de {paretoData.length} productos generan el 80% de los ingresos
        </p>
      </div>

      {/* Daily sales by marketplace */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4">Venta Diaria por Marketplace</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyByMarketplace}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis dataKey="date" fontSize={10} stroke="hsl(215, 12%, 50%)" />
              <YAxis fontSize={10} stroke="hsl(215, 12%, 50%)" />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(220, 18%, 12%)', border: '1px solid hsl(220, 15%, 18%)', borderRadius: '8px', fontSize: '12px', color: 'hsl(210, 20%, 92%)' }} />
              <Legend />
              <Bar dataKey="SHEIN" stackId="a" fill="hsl(175, 80%, 45%)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="TIKTOK" stackId="a" fill="hsl(260, 60%, 55%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
