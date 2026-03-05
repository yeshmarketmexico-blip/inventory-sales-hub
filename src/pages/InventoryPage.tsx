import { useMemo } from 'react';
import { useData } from '@/hooks/useSheetData';
import { KPICard } from '@/components/KPICard';
import { Package, AlertTriangle, Clock, DollarSign } from 'lucide-react';
import { Tooltip as RechartsTooltip, ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ZAxis, Cell } from 'recharts';

export default function InventoryPage() {
  const { inventory, sales, marketplace } = useData();

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

  // Enriched inventory
  const enriched = useMemo(() => {
    return inventory.map(item => {
      const avgDaily = avgDailySales.get(item.SKU) || 0;
      const daysLeft = avgDaily > 0 ? Math.round(item.Stock / avgDaily) : 999;
      const margin = item.PrecioVenta > 0 ? ((item.PrecioVenta - item.PrecioCompra) / item.PrecioVenta) * 100 : 0;
      const needsReorder = item.Stock <= item.PuntoReorden;
      return { ...item, avgDaily: Math.round(avgDaily * 10) / 10, daysLeft, margin: Math.round(margin), needsReorder };
    });
  }, [inventory, avgDailySales]);

  // Heatmap data: volume (total sales qty) vs margin
  const heatmapData = useMemo(() => {
    return enriched.map(item => {
      const totalSold = sales.filter(s => s.SKU === item.SKU).reduce((sum, s) => sum + s.Cantidad, 0);
      return { name: item.Producto, volume: totalSold, margin: item.margin, stock: item.Stock };
    });
  }, [enriched, sales]);

  const criticalCount = enriched.filter(i => i.needsReorder).length;
  const totalValue = enriched.reduce((s, i) => s + i.Stock * i.PrecioVenta, 0);
  const fmt = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

  const getHeatColor = (margin: number) => {
    if (margin > 50) return 'hsl(152, 70%, 45%)';
    if (margin > 35) return 'hsl(175, 80%, 45%)';
    if (margin > 20) return 'hsl(38, 92%, 55%)';
    return 'hsl(0, 72%, 55%)';
  };

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

      {/* Inventory Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Producto</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Stock</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">P. Reorden</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Vta/Día</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Días Inv.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Margen</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Estado</th>
              </tr>
            </thead>
            <tbody>
              {enriched.map(item => (
                <tr key={item.SKU + item.Marketplace} className="border-b border-border hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-primary">{item.SKU}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{item.Producto}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{item.Stock}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{item.PuntoReorden}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{item.avgDaily}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    <span className={item.daysLeft < 7 ? 'text-destructive' : item.daysLeft < 14 ? 'text-warning' : 'text-success'}>
                      {item.daysLeft > 900 ? '∞' : item.daysLeft}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{item.margin}%</td>
                  <td className="px-4 py-3 text-center">
                    {item.needsReorder ? (
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
              <RechartsTooltip
                contentStyle={{ backgroundColor: 'hsl(220, 18%, 12%)', border: '1px solid hsl(220, 15%, 18%)', borderRadius: '8px', fontSize: '12px', color: 'hsl(210, 20%, 92%)' }}
                formatter={(value: number, name: string) => [value, name]}
              />
              <Scatter data={heatmapData}>
                {heatmapData.map((entry, i) => (
                  <Cell key={i} fill={getHeatColor(entry.margin)} fillOpacity={0.8} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
