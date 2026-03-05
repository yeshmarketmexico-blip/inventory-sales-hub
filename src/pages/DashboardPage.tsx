import { useMemo } from 'react';
import { useData } from '@/hooks/useSheetData';
import { KPICard } from '@/components/KPICard';
import { DollarSign, Package, AlertTriangle, TrendingUp, BarChart3, Star, Snail } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';

export default function DashboardPage() {
  const { inventory, sales, marketplace } = useData();

  const stats = useMemo(() => {
    const totalInventoryValue = inventory.reduce((sum, i) => sum + i.Stock * i.PrecioVenta, 0);
    const totalUnits = inventory.reduce((sum, i) => sum + i.Stock, 0);
    const totalRevenue = sales.reduce((sum, s) => sum + s.Total, 0);
    // Usar Utilidad real de API (liquidación TikTok / precio - costo SHEIN)
    const totalUtilidad = sales.reduce((sum, s) => sum + (s.Utilidad || 0), 0);
    const netMargin = totalRevenue > 0 ? (totalUtilidad / totalRevenue) * 100 : 0;
    const criticalItems = inventory.filter(i => i.Stock <= i.PuntoReorden).length;

    return { totalInventoryValue, totalUnits, totalRevenue, netMargin, criticalItems };
  }, [inventory, sales]);

  // Daily sales trend
  const dailySales = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach(s => {
      map.set(s.Fecha, (map.get(s.Fecha) || 0) + s.Total);
    });
    const sorted = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date: date.slice(5), total: Math.round(total) }));

    // Simple projection: extend 7 days with moving average
    if (sorted.length > 3) {
      const lastN = sorted.slice(-7);
      const avg = lastN.reduce((s, d) => s + d.total, 0) / lastN.length;
      for (let i = 1; i <= 7; i++) {
        const projected = Math.round(avg * (1 + (Math.random() - 0.5) * 0.1));
        sorted.push({ date: `+${i}d`, total: 0, projected } as any);
      }
    }
    return sorted;
  }, [sales]);

  // Top & Bottom products by units sold
  const productRanking = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    sales.forEach(s => {
      const existing = map.get(s.SKU) || { name: s.Producto, qty: 0, revenue: 0 };
      existing.qty += s.Cantidad;
      existing.revenue += s.Total;
      map.set(s.SKU, existing);
    });
    const arr = Array.from(map.entries()).map(([sku, data]) => ({ sku, ...data }));
    arr.sort((a, b) => b.qty - a.qty);
    return { top5: arr.slice(0, 5), bottom5: arr.slice(-5).reverse() };
  }, [sales]);

  // Health status
  const healthStatus = useMemo(() => {
    const critical = inventory.filter(i => i.Stock <= i.PuntoReorden).length;
    const warning = inventory.filter(i => i.Stock > i.PuntoReorden && i.Stock <= i.PuntoReorden * 2).length;
    const ratio = inventory.length > 0 ? critical / inventory.length : 0;
    if (ratio > 0.3) return { emoji: '🔴', label: 'Crítico', color: 'destructive' as const };
    if (ratio > 0.1 || warning > 3) return { emoji: '🟡', label: 'Precaución', color: 'warning' as const };
    return { emoji: '🟢', label: 'Saludable', color: 'success' as const };
  }, [inventory]);

  const fmt = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Dashboard Ejecutivo</h2>
        <p className="text-xs text-muted-foreground">
          Estado de salud — {marketplace} {healthStatus.emoji} {healthStatus.label}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Valor Inventario"
          value={fmt(stats.totalInventoryValue)}
          icon={<DollarSign className="w-4 h-4" />}
          trend={5.2}
        />
        <KPICard
          title="Margen Neto"
          value={`${stats.netMargin.toFixed(1)}%`}
          icon={<TrendingUp className="w-4 h-4" />}
          status={stats.netMargin > 30 ? 'success' : stats.netMargin > 15 ? 'warning' : 'destructive'}
          trend={2.1}
        />
        <KPICard
          title="Unidades Totales"
          value={stats.totalUnits.toLocaleString()}
          icon={<Package className="w-4 h-4" />}
        />
        <KPICard
          title="Alertas Reorden"
          value={stats.criticalItems}
          icon={<AlertTriangle className="w-4 h-4" />}
          status={stats.criticalItems > 3 ? 'destructive' : stats.criticalItems > 0 ? 'warning' : 'success'}
          subtitle={stats.criticalItems > 0 ? 'Productos bajo mínimo' : 'Todo en orden'}
        />
      </div>

      {/* Sales Trend Chart */}
      <div className="rounded-xl border border-border bg-card p-4 md:p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Tendencia de Ventas Diarias
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailySales}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(175, 80%, 45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(175, 80%, 45%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(260, 60%, 55%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(260, 60%, 55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis dataKey="date" stroke="hsl(215, 12%, 50%)" fontSize={10} />
              <YAxis stroke="hsl(215, 12%, 50%)" fontSize={10} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(220, 18%, 12%)',
                  border: '1px solid hsl(220, 15%, 18%)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'hsl(210, 20%, 92%)',
                }}
              />
              <Area type="monotone" dataKey="total" stroke="hsl(175, 80%, 45%)" fill="url(#colorTotal)" strokeWidth={2} />
              <Area type="monotone" dataKey="projected" stroke="hsl(260, 60%, 55%)" fill="url(#colorProjected)" strokeWidth={2} strokeDasharray="5 5" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top & Bottom Products */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-warning" />
            Top 5 Productos Estrella
          </h3>
          <div className="space-y-2">
            {productRanking.top5.map((p, i) => (
              <div key={p.sku} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold font-mono text-primary w-5">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.sku}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-bold text-foreground">{p.qty} uds</p>
                  <p className="text-xs text-muted-foreground font-mono">{fmt(p.revenue)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Snail className="w-4 h-4 text-destructive" />
            Bottom 5 Rotación Baja
          </h3>
          <div className="space-y-2">
            {productRanking.bottom5.map((p, i) => (
              <div key={p.sku} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold font-mono text-destructive w-5">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.sku}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-bold text-foreground">{p.qty} uds</p>
                  <p className="text-xs text-muted-foreground font-mono">{fmt(p.revenue)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
