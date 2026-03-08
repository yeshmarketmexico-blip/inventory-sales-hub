import { useMemo, useState } from 'react';
import { useData } from '@/hooks/useSheetData';
import { KPICard } from '@/components/KPICard';
import { DollarSign, TrendingUp, ShoppingBag, BarChart3, Search, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Line, ComposedChart, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';

const COLORS = [
  'hsl(175, 80%, 45%)', 'hsl(260, 60%, 55%)', 'hsl(38, 92%, 55%)',
  'hsl(152, 70%, 45%)', 'hsl(0, 72%, 55%)', 'hsl(200, 70%, 50%)',
  'hsl(320, 60%, 50%)', 'hsl(80, 60%, 45%)',
];

type SortKey = 'qty' | 'revenue' | 'utilidad' | 'margin' | 'name';

export default function SalesPage() {
  const { sales, marketplace } = useData();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('qty');
  const [sortAsc, setSortAsc] = useState(false);
  const [tableSearch, setTableSearch] = useState('');

  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((s, sale) => s + (sale.Total || 0), 0);
    const totalUnits = sales.reduce((s, sale) => s + (sale.Cantidad || 0), 0);
    const dateSet = new Set(sales.map(s => s.Fecha));
    const days = dateSet.size || 1;
    const dailyAvg = totalRevenue / days;
    const profit = sales.reduce((s, sale) => s + (sale.Utilidad || 0), 0);
    const totalCost = sales.reduce((s, sale) => s + (sale.Costo || 0), 0);
    const avgMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;
    return { totalRevenue, totalUnits, dailyAvg, profit, days, avgMargin };
  }, [sales]);

  // Product-level aggregation
  const productStats = useMemo(() => {
    const map = new Map<string, {
      sku: string; name: string; qty: number; revenue: number;
      utilidad: number; costo: number; orders: number; marketplace: string;
    }>();
    sales.forEach(s => {
      const key = s.SKU || s.Producto;
      const ex = map.get(key) || {
        sku: s.SKU, name: s.Producto, qty: 0, revenue: 0,
        utilidad: 0, costo: 0, orders: 0, marketplace: s.Marketplace,
      };
      ex.qty += s.Cantidad || 0;
      ex.revenue += s.Total || 0;
      ex.utilidad += s.Utilidad || 0;
      ex.costo += s.Costo || 0;
      ex.orders += 1;
      map.set(key, ex);
    });
    return Array.from(map.values()).map(p => ({
      ...p,
      margin: p.revenue > 0 ? ((p.revenue - p.costo) / p.revenue) * 100 : 0,
      avgPrice: p.qty > 0 ? p.revenue / p.qty : 0,
    }));
  }, [sales]);

  // Sorted & filtered product stats
  const sortedProducts = useMemo(() => {
    let filtered = productStats;
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(p =>
        p.sku.toLowerCase().includes(s) || p.name.toLowerCase().includes(s)
      );
    }
    return filtered.sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case 'qty': diff = a.qty - b.qty; break;
        case 'revenue': diff = a.revenue - b.revenue; break;
        case 'utilidad': diff = a.utilidad - b.utilidad; break;
        case 'margin': diff = a.margin - b.margin; break;
        case 'name': diff = a.name.localeCompare(b.name); break;
      }
      return sortAsc ? diff : -diff;
    });
  }, [productStats, search, sortKey, sortAsc]);

  // Pareto data
  const paretoData = useMemo(() => {
    const sorted = [...productStats]
      .sort((a, b) => b.revenue - a.revenue)
      .map(p => ({
        name: p.name.length > 30 ? p.name.substring(0, 30) + '…' : p.name,
        revenue: Math.round(p.revenue), utilidad: Math.round(p.utilidad),
      }));
    const totalRev = sorted.reduce((s, p) => s + p.revenue, 0);
    let cum = 0;
    return sorted.map(p => {
      cum += p.revenue;
      return { ...p, cumPct: Math.round((cum / totalRev) * 100) };
    });
  }, [productStats]);

  // Daily revenue trend
  const dailyTrend = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; orders: number; units: number }>();
    sales.forEach(s => {
      const ex = map.get(s.Fecha) || { date: s.Fecha, revenue: 0, orders: 0, units: 0 };
      ex.revenue += s.Total || 0;
      ex.orders += 1;
      ex.units += s.Cantidad || 0;
      map.set(s.Fecha, ex);
    });
    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({ ...d, date: d.date.slice(5), revenue: Math.round(d.revenue) }));
  }, [sales]);

  // Sales by marketplace pie
  const marketplacePie = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach(s => {
      map.set(s.Marketplace, (map.get(s.Marketplace) || 0) + (s.Total || 0));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [sales]);

  // Daily by marketplace (stacked)
  const dailyByMarketplace = useMemo(() => {
    const map = new Map<string, { date: string; SHEIN: number; TIKTOK: number }>();
    sales.forEach(s => {
      const ex = map.get(s.Fecha) || { date: s.Fecha, SHEIN: 0, TIKTOK: 0 };
      if (s.Marketplace === 'SHEIN') ex.SHEIN += s.Total || 0;
      else if (s.Marketplace === 'TIKTOK') ex.TIKTOK += s.Total || 0;
      map.set(s.Fecha, ex);
    });
    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({ ...d, date: d.date.slice(5), SHEIN: Math.round(d.SHEIN), TIKTOK: Math.round(d.TIKTOK) }));
  }, [sales]);

  // Top 10 products by qty
  const topByQty = useMemo(() => {
    return [...productStats]
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
      .map(p => ({
        name: p.name.length > 25 ? p.name.substring(0, 25) + '…' : p.name,
        qty: p.qty, revenue: Math.round(p.revenue),
      }));
  }, [productStats]);

  // Filtered sales for table
  const filteredSales = useMemo(() => {
    if (!tableSearch) return sales;
    const s = tableSearch.toLowerCase();
    return sales.filter(sale =>
      sale.IDOrden.toLowerCase().includes(s) ||
      sale.Producto.toLowerCase().includes(s) ||
      sale.SKU.toLowerCase().includes(s)
    );
  }, [sales, tableSearch]);

  const fmt = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
  const tooltipStyle = { backgroundColor: 'hsl(220, 18%, 12%)', border: '1px solid hsl(220, 15%, 18%)', borderRadius: '8px', fontSize: '12px', color: 'hsl(210, 20%, 92%)' };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortHeader = ({ label, sKey }: { label: string; sKey: SortKey }) => (
    <button onClick={() => handleSort(sKey)}
      className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase hover:text-foreground transition-colors">
      {label} <ArrowUpDown className="w-3 h-3" />
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Desempeño de Ventas</h2>
        <p className="text-xs text-muted-foreground">{marketplace} — {stats.days} días analizados · {sales.length} órdenes</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Ingresos Totales" value={fmt(stats.totalRevenue)} icon={<DollarSign className="w-4 h-4" />} />
        <KPICard title="Utilidad Real" value={fmt(stats.profit)} icon={<TrendingUp className="w-4 h-4" />} status={stats.profit > 0 ? 'success' : 'destructive'} />
        <KPICard title="Venta Diaria" value={fmt(stats.dailyAvg)} icon={<BarChart3 className="w-4 h-4" />} />
        <KPICard title="Unidades Vendidas" value={stats.totalUnits.toLocaleString()} icon={<ShoppingBag className="w-4 h-4" />} />
      </div>

      {/* Revenue Trend */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4">Tendencia de Ingresos</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis dataKey="date" fontSize={9} stroke="hsl(215, 12%, 50%)" />
              <YAxis fontSize={10} stroke="hsl(215, 12%, 50%)" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(175, 80%, 45%)" fill="hsl(175, 80%, 45%)" fillOpacity={0.2} name="Ingresos" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row: Marketplace pie + Top products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {marketplacePie.length > 1 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">Distribución por Canal</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={marketplacePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} fontSize={10}>
                    {marketplacePie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Top 10 por Unidades</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topByQty} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                <XAxis type="number" fontSize={10} stroke="hsl(215, 12%, 50%)" />
                <YAxis dataKey="name" type="category" width={120} fontSize={8} stroke="hsl(215, 12%, 50%)" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="qty" name="Unidades" fill="hsl(175, 80%, 45%)" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Pareto */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-1">Análisis Pareto (80/20)</h3>
        <p className="text-xs text-muted-foreground mb-4">
          {paretoData.filter(p => p.cumPct <= 80).length} de {paretoData.length} productos generan el 80% de los ingresos
        </p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={paretoData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis dataKey="name" fontSize={8} stroke="hsl(215, 12%, 50%)" angle={-30} textAnchor="end" height={60} />
              <YAxis yAxisId="left" fontSize={10} stroke="hsl(215, 12%, 50%)" />
              <YAxis yAxisId="right" orientation="right" fontSize={10} stroke="hsl(215, 12%, 50%)" unit="%" domain={[0, 100]} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [n === '% Acum.' ? `${v}%` : fmt(v), n]} />
              <Bar yAxisId="left" dataKey="revenue" fill="hsl(175, 80%, 45%)" radius={[4,4,0,0]} name="Ingresos" />
              <Bar yAxisId="left" dataKey="utilidad" fill="hsl(260, 60%, 55%)" radius={[4,4,0,0]} name="Utilidad" />
              <Line yAxisId="right" dataKey="cumPct" stroke="hsl(38, 92%, 55%)" strokeWidth={2} dot={false} name="% Acum." />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily by marketplace */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4">Venta Diaria por Marketplace</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyByMarketplace}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis dataKey="date" fontSize={9} stroke="hsl(215, 12%, 50%)" />
              <YAxis fontSize={10} stroke="hsl(215, 12%, 50%)" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
              <Legend />
              <Bar dataKey="SHEIN" stackId="a" fill="hsl(175, 80%, 45%)" />
              <Bar dataKey="TIKTOK" stackId="a" fill="hsl(260, 60%, 55%)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Product-level Sales List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Ventas por Producto ({sortedProducts.length})</h3>
            <p className="text-xs text-muted-foreground">Análisis detallado por producto</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar producto o SKU…" value={search}
              onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 h-8 text-xs" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3"><SortHeader label="Producto" sKey="name" /></th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">SKU</th>
                <th className="text-right px-4 py-3"><SortHeader label="Unidades" sKey="qty" /></th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Órdenes</th>
                <th className="text-right px-4 py-3"><SortHeader label="Ingresos" sKey="revenue" /></th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Costo</th>
                <th className="text-right px-4 py-3"><SortHeader label="Utilidad" sKey="utilidad" /></th>
                <th className="text-right px-4 py-3"><SortHeader label="Margen" sKey="margin" /></th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Canal</th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map((p, idx) => (
                <tr key={`${p.sku}-${idx}`} className="border-b border-border hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate" title={p.name}>
                    {p.name.length > 45 ? p.name.substring(0, 45) + '…' : p.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-primary">{p.sku}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground font-bold">{p.qty}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{p.orders}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{fmt(p.revenue)}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{fmt(p.costo)}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    <span className={p.utilidad >= 0 ? 'text-success' : 'text-destructive'}>
                      {fmt(p.utilidad)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{p.margin.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      p.marketplace === 'SHEIN' ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-accent-foreground'
                    }`}>{p.marketplace}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual Sales Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Detalle de Órdenes ({filteredSales.length})</h3>
            <p className="text-xs text-muted-foreground">Lista completa de ventas — {marketplace}</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar orden, producto o SKU…" value={tableSearch}
              onChange={e => setTableSearch(e.target.value)} className="pl-9 bg-secondary/50 h-8 text-xs" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">ID Orden</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Producto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">SKU</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Cant.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Liquidación</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Costo</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Utilidad</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Margen</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Canal</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales
                .slice()
                .sort((a, b) => b.Fecha.localeCompare(a.Fecha))
                .map((sale, idx) => (
                <tr key={`${sale.IDOrden}-${sale.SKU}-${idx}`} className="border-b border-border hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-primary">{sale.IDOrden}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{sale.Fecha}</td>
                  <td className="px-4 py-3 font-medium text-foreground max-w-[180px] truncate" title={sale.Producto}>
                    {sale.Producto.length > 40 ? sale.Producto.substring(0, 40) + '…' : sale.Producto}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{sale.SKU}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{sale.Cantidad}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{fmt(sale.Total)}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{fmt(sale.Costo)}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    <span className={sale.Utilidad >= 0 ? 'text-success' : 'text-destructive'}>{fmt(sale.Utilidad)}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{sale.Margen.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      sale.Marketplace === 'SHEIN' ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-accent-foreground'
                    }`}>{sale.Marketplace}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
