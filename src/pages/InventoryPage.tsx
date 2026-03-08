import { useMemo, useState } from 'react';
import { useData } from '@/hooks/useSheetData';
import { KPICard } from '@/components/KPICard';
import { Package, AlertTriangle, Clock, DollarSign, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Tooltip as RechartsTooltip, ResponsiveContainer, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, ZAxis, Cell, PieChart, Pie, BarChart, Bar, Legend,
} from 'recharts';

const COLORS = [
  'hsl(175, 80%, 45%)', 'hsl(260, 60%, 55%)', 'hsl(38, 92%, 55%)',
  'hsl(152, 70%, 45%)', 'hsl(0, 72%, 55%)', 'hsl(200, 70%, 50%)',
  'hsl(320, 60%, 50%)', 'hsl(80, 60%, 45%)',
];

export default function InventoryPage() {
  const { inventory, sales, marketplace } = useData();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Calculate avg daily sales per SKU
  const avgDailySales = useMemo(() => {
    const map = new Map<string, { totalQty: number; days: Set<string> }>();
    sales.forEach(s => {
      const existing = map.get(s.SKU) || { totalQty: 0, days: new Set<string>() };
      existing.totalQty += s.Cantidad;
      existing.days.add(s.Fecha);
      map.set(s.SKU, existing);
    });
    const result = new Map<string, number>();
    map.forEach((v, k) => result.set(k, v.days.size > 0 ? v.totalQty / v.days.size : 0));
    return result;
  }, [sales]);

  // Total sales qty per SKU
  const totalSalesBySku = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach(s => {
      map.set(s.SKU, (map.get(s.SKU) || 0) + s.Cantidad);
    });
    return map;
  }, [sales]);

  // Enriched inventory
  const enriched = useMemo(() => {
    return inventory.map(item => {
      const avgDaily = avgDailySales.get(item.SKU) || 0;
      const totalSold = totalSalesBySku.get(item.SKU) || 0;
      const daysLeft = avgDaily > 0 ? Math.round(item.Stock / avgDaily) : 999;
      const margin = item.PrecioVenta > 0 ? ((item.PrecioVenta - item.PrecioCompra) / item.PrecioVenta) * 100 : 0;
      const needsReorder = item.Stock <= item.PuntoReorden;
      return { ...item, avgDaily: Math.round(avgDaily * 10) / 10, totalSold, daysLeft, margin: Math.round(margin), needsReorder };
    });
  }, [inventory, avgDailySales, totalSalesBySku]);

  // Filtered
  const filtered = useMemo(() => {
    return enriched.filter(item => {
      if (search) {
        const s = search.toLowerCase();
        const matchSku = item.SKU.toLowerCase().includes(s);
        const matchName = item.Producto.toLowerCase().includes(s);
        const matchCat = item.Categoria.toLowerCase().includes(s);
        if (!matchSku && !matchName && !matchCat) return false;
      }
      if (filterStatus === 'reorder') return item.needsReorder;
      if (filterStatus === 'low') return item.daysLeft < 14 && !item.needsReorder;
      if (filterStatus === 'ok') return !item.needsReorder && item.daysLeft >= 14;
      if (filterStatus === 'out') return item.Stock === 0;
      return true;
    });
  }, [enriched, search, filterStatus]);

  // Chart data: stock by category
  const categoryData = useMemo(() => {
    const map = new Map<string, { stock: number; value: number; count: number }>();
    enriched.forEach(item => {
      const ex = map.get(item.Categoria) || { stock: 0, value: 0, count: 0 };
      ex.stock += item.Stock; ex.value += item.ValorTotal; ex.count += 1;
      map.set(item.Categoria, ex);
    });
    return Array.from(map.entries())
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.value - a.value);
  }, [enriched]);

  // Top sellers from inventory
  const topSellers = useMemo(() => {
    return enriched
      .filter(i => i.totalSold > 0)
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, 10)
      .map(i => ({
        name: i.Producto.length > 30 ? i.Producto.substring(0, 30) + '…' : i.Producto,
        sold: i.totalSold,
        stock: i.Stock,
        margin: i.margin,
      }));
  }, [enriched]);

  // Margin distribution
  const marginDistribution = useMemo(() => {
    const buckets = [
      { name: '<0%', count: 0 }, { name: '0-20%', count: 0 },
      { name: '20-40%', count: 0 }, { name: '40-60%', count: 0 }, { name: '>60%', count: 0 },
    ];
    enriched.forEach(i => {
      if (i.margin < 0) buckets[0].count++;
      else if (i.margin < 20) buckets[1].count++;
      else if (i.margin < 40) buckets[2].count++;
      else if (i.margin < 60) buckets[3].count++;
      else buckets[4].count++;
    });
    return buckets;
  }, [enriched]);

  // Heatmap data
  const heatmapData = useMemo(() => {
    return enriched.map(item => ({
      name: item.Producto.length > 30 ? item.Producto.substring(0, 30) + '…' : item.Producto,
      volume: item.totalSold, margin: item.margin, stock: item.Stock,
    }));
  }, [enriched]);

  const criticalCount = enriched.filter(i => i.needsReorder).length;
  const outOfStock = enriched.filter(i => i.Stock === 0).length;
  const totalValue = enriched.reduce((s, i) => s + i.Stock * i.PrecioVenta, 0);
  const fmt = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
  const tooltipStyle = { backgroundColor: 'hsl(220, 18%, 12%)', border: '1px solid hsl(220, 15%, 18%)', borderRadius: '8px', fontSize: '12px', color: 'hsl(210, 20%, 92%)' };

  const getHeatColor = (margin: number) => {
    if (margin > 50) return 'hsl(152, 70%, 45%)';
    if (margin > 35) return 'hsl(175, 80%, 45%)';
    if (margin > 20) return 'hsl(38, 92%, 55%)';
    return 'hsl(0, 72%, 55%)';
  };

  const statusFilters = [
    { key: 'all', label: 'Todos' },
    { key: 'reorder', label: `🔴 Reordenar (${enriched.filter(i => i.needsReorder).length})` },
    { key: 'low', label: `⚠️ Bajo (${enriched.filter(i => i.daysLeft < 14 && !i.needsReorder).length})` },
    { key: 'ok', label: `✓ OK (${enriched.filter(i => !i.needsReorder && i.daysLeft >= 14).length})` },
    { key: 'out', label: `Agotado (${outOfStock})` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Control de Inventario</h2>
        <p className="text-xs text-muted-foreground">{marketplace} — {enriched.length} productos</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Productos" value={enriched.length} icon={<Package className="w-4 h-4" />} />
        <KPICard title="Valor Total" value={fmt(totalValue)} icon={<DollarSign className="w-4 h-4" />} />
        <KPICard title="Alertas Reorden" value={criticalCount} icon={<AlertTriangle className="w-4 h-4" />} status={criticalCount > 3 ? 'destructive' : criticalCount > 0 ? 'warning' : 'success'} />
        <KPICard title="Prom. Días Inv." value={Math.round(enriched.reduce((s, i) => s + i.daysLeft, 0) / (enriched.length || 1))} icon={<Clock className="w-4 h-4" />} subtitle="días promedio restantes" />
      </div>

      {/* Charts Row 1: Category breakdown + Margin distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Valor por Categoría</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}
                  fontSize={9}>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <RechartsTooltip contentStyle={tooltipStyle}
                  formatter={(v: number, name: string) => [fmt(v), name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Distribución de Margen</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={marginDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                <XAxis dataKey="name" fontSize={10} stroke="hsl(215, 12%, 50%)" />
                <YAxis fontSize={10} stroke="hsl(215, 12%, 50%)" />
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Productos" radius={[4,4,0,0]}>
                  {marginDistribution.map((entry, i) => (
                    <Cell key={i} fill={
                      entry.name === '<0%' ? 'hsl(0, 72%, 55%)' :
                      entry.name === '0-20%' ? 'hsl(38, 92%, 55%)' :
                      entry.name === '20-40%' ? 'hsl(175, 80%, 45%)' :
                      'hsl(152, 70%, 45%)'
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Sellers Chart */}
      {topSellers.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Top 10 Productos Más Vendidos</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSellers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                <XAxis type="number" fontSize={10} stroke="hsl(215, 12%, 50%)" />
                <YAxis dataKey="name" type="category" width={150} fontSize={8} stroke="hsl(215, 12%, 50%)" />
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="sold" name="Vendidos" fill="hsl(175, 80%, 45%)" radius={[0,4,4,0]} />
                <Bar dataKey="stock" name="Stock" fill="hsl(260, 60%, 55%)" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Heatmap */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4">Mapa de Calor: Volumen vs Margen</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis dataKey="volume" name="Volumen" fontSize={10} stroke="hsl(215, 12%, 50%)" label={{ value: 'Unidades Vendidas', position: 'bottom', fontSize: 10, fill: 'hsl(215, 12%, 50%)' }} />
              <YAxis dataKey="margin" name="Margen %" fontSize={10} stroke="hsl(215, 12%, 50%)" label={{ value: 'Margen %', angle: -90, position: 'insideLeft', fontSize: 10, fill: 'hsl(215, 12%, 50%)' }} />
              <ZAxis dataKey="stock" range={[50, 400]} />
              <RechartsTooltip contentStyle={tooltipStyle}
                formatter={(value: number, name: string) => [value, name]} />
              <Scatter data={heatmapData}>
                {heatmapData.map((entry, i) => (
                  <Cell key={i} fill={getHeatColor(entry.margin)} fillOpacity={0.8} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por SKU, producto o categoría…" value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9 bg-card" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statusFilters.map(f => (
            <button key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Inventario ({filtered.length} de {enriched.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Producto</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Stock</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Vendidos</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Vta/Día</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Días Inv.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Precio</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Costo</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Margen</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => (
                <tr key={`${item.SKU}-${item.Marketplace}-${idx}`} className="border-b border-border hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-primary">{item.SKU}</td>
                  <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate" title={item.Producto}>
                    {item.Producto.length > 45 ? item.Producto.substring(0, 45) + '…' : item.Producto}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{item.Stock}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{item.totalSold}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{item.avgDaily}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    <span className={item.daysLeft < 7 ? 'text-destructive' : item.daysLeft < 14 ? 'text-warning' : 'text-success'}>
                      {item.daysLeft > 900 ? '∞' : item.daysLeft}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{fmt(item.PrecioVenta)}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{fmt(item.PrecioCompra)}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{item.margin}%</td>
                  <td className="px-4 py-3 text-center">
                    {item.Stock === 0 ? (
                      <span className="text-xs text-destructive font-medium">🔴 Agotado</span>
                    ) : item.needsReorder ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                        <AlertTriangle className="w-3 h-3" /> Reordenar
                      </span>
                    ) : item.daysLeft < 14 ? (
                      <span className="text-xs text-warning">⚠️ Bajo</span>
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
    </div>
  );
}
