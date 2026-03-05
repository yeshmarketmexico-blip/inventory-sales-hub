import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';

export type Marketplace = 'SHEIN' | 'TIKTOK' | 'COMBINADO';

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export interface InventoryItem {
  SKU: string;
  Producto: string;
  Stock: number;
  PrecioCompra: number;
  PrecioVenta: number;
  Categoria: string;
  PuntoReorden: number;
  Marketplace: string;
  MargenPct: number;
  GananciaUnit: number;
  ValorTotal: number;
  Estado: string;
  [key: string]: string | number;
}

export interface SaleItem {
  SKU: string;
  Producto: string;
  Cantidad: number;
  PrecioVenta: number;
  Total: number;
  Fecha: string;
  Marketplace: string;
  [key: string]: string | number;
}

interface DataContextType {
  marketplace: Marketplace;
  setMarketplace: (m: Marketplace) => void;
  dateRange: DateRange;
  setDateRange: (r: DateRange) => void;
  inventory: InventoryItem[];
  sales: SaleItem[];
  loading: boolean;
  error: string | null;
  usingDemo: boolean;
  refreshData: () => void;
}

const DataContext = createContext<DataContextType | null>(null);

// URLs correctas con action params
const INVENTORY_URL = 'https://script.google.com/macros/s/AKfycbweOy2ly59Fir1sT1lmWAaCL2oFXnxu6f2Ba9EFKHDfkYuOQVrQEG_NKFKfLgb6AqET/exec?action=inventario';
const SALES_URL = 'https://script.google.com/macros/s/AKfycby4hH7qI9rkFh5yOZ1ZYD2NBF9fki4tlLP9Tjat1QnZO3sVJHxuCKZDvFfr7l4zACAw/exec?action=%C3%B3rdenes';

function inferCategoria(nombre: string): string {
  const n = nombre.toLowerCase();
  if (n.includes('tapete') && n.includes('yoga')) return 'Yoga & Fitness';
  if (n.includes('tapete') && n.includes('foamy')) return 'Tapetes Infantiles';
  if (n.includes('tapete') && n.includes('gym')) return 'Gym';
  if (n.includes('mancuerna') || n.includes('pesa')) return 'Pesas';
  if (n.includes('caja') && n.includes('plástica')) return 'Almacenamiento';
  if (n.includes('papel') || n.includes('cartulina') || n.includes('opalina')) return 'Papelería';
  if (n.includes('tabla') && n.includes('natación')) return 'Natación';
  if (n.includes('bote') || n.includes('basura')) return 'Hogar';
  if (n.includes('organizador') || n.includes('mesa') || n.includes('silla')) return 'Hogar';
  if (n.includes('tortilla') || n.includes('salsero') || n.includes('molcajete')) return 'Cocina';
  return 'General';
}

// Normaliza inventario con los campos REALES de la API:
// "ID Producto", "Nombre", "SKU", "Stock", "Precio MXN",
// "✏️ Costo Unitario", "Valor Total", "Ganancia Unit.", "Margen %", "Estado"
function normalizeInventory(raw: any[]): InventoryItem[] {
  return raw
    .filter(r =>
      r['ID Producto'] &&
      r['ID Producto'] !== 'TOTALES' &&
      r['Nombre'] &&
      r['SKU'] !== '' &&
      r['SKU'] !== undefined &&
      r['SKU'] !== null
    )
    .map(r => ({
      SKU: String(r['SKU'] || ''),
      Producto: String(r['Nombre'] || ''),
      Stock: Number(r['Stock'] || 0),
      PrecioCompra: Number(r['✏️ Costo Unitario'] || 0),
      PrecioVenta: Number(r['Precio MXN'] || 0),
      Categoria: inferCategoria(String(r['Nombre'] || '')),
      PuntoReorden: 5,
      Marketplace: 'SHEIN',
      MargenPct: typeof r['Margen %'] === 'number' ? r['Margen %'] : 0,
      GananciaUnit: Number(r['Ganancia Unit.'] || 0),
      ValorTotal: Number(r['Valor Total'] || 0),
      Estado: String(r['Estado'] || ''),
    }));
}

function normalizeSales(raw: any[], inv: InventoryItem[]): SaleItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(r => r.SKU || r.sku)
    .map(r => {
      const sku = String(r.SKU || r.sku || '');
      const cantidad = Number(r.Cantidad || r.UnidadesVendidas || r.cantidad || 0);
      const item = inv.find(i => i.SKU === sku);
      const precio = Number(r.PrecioVenta || r['Precio MXN'] || item?.PrecioVenta || 0);
      return {
        SKU: sku,
        Producto: String(r.Producto || r.Nombre || item?.Producto || ''),
        Cantidad: cantidad,
        PrecioVenta: precio,
        Total: Number(r.Total || r.total || cantidad * precio),
        Fecha: String(r.Fecha || r.fecha || '').split('T')[0],
        Marketplace: String(r.Marketplace || r.Canal || 'SHEIN').toUpperCase(),
      };
    })
    .filter(s => s.Cantidad > 0);
}

function mergeInventory(items: InventoryItem[]): InventoryItem[] {
  const map = new Map<string, InventoryItem>();
  items.forEach(item => {
    const ex = map.get(item.SKU);
    if (ex) { ex.Stock += item.Stock; ex.ValorTotal += item.ValorTotal; }
    else map.set(item.SKU, { ...item, Marketplace: 'COMBINADO' });
  });
  return Array.from(map.values());
}

function mergeSales(items: SaleItem[]): SaleItem[] {
  const map = new Map<string, SaleItem>();
  items.forEach(item => {
    const key = `${item.SKU}-${item.Fecha}`;
    const ex = map.get(key);
    if (ex) { ex.Cantidad += item.Cantidad; ex.Total += item.Total; }
    else map.set(key, { ...item, Marketplace: 'COMBINADO' });
  });
  return Array.from(map.values());
}

// Demo data basado en productos reales de Yesh Market
function generateDemoInventory(): InventoryItem[] {
  return [
    { SKU: '664554604291', Producto: 'Caja Plástica Uso Rudo 55x36x37cm 54 Lts Negro', Stock: 11, PrecioCompra: 136, PrecioVenta: 269, Categoria: 'Almacenamiento', PuntoReorden: 5, Marketplace: 'SHEIN', MargenPct: 49.4, GananciaUnit: 133, ValorTotal: 2959, Estado: '🟢 OK' },
    { SKU: '783214469800', Producto: 'Tapete Yoga 4MM Camello', Stock: 41, PrecioCompra: 42, PrecioVenta: 99, Categoria: 'Yoga & Fitness', PuntoReorden: 5, Marketplace: 'SHEIN', MargenPct: 57.6, GananciaUnit: 57, ValorTotal: 4059, Estado: '🟢 OK' },
    { SKU: '664554605250', Producto: 'Tapete Yoga 4MM Rosa', Stock: 75, PrecioCompra: 42, PrecioVenta: 99, Categoria: 'Yoga & Fitness', PuntoReorden: 5, Marketplace: 'SHEIN', MargenPct: 57.6, GananciaUnit: 57, ValorTotal: 7425, Estado: '🟢 OK' },
    { SKU: '749460136637', Producto: 'Papel Bond Blanco 500 Hojas Oficio', Stock: 99, PrecioCompra: 84, PrecioVenta: 149, Categoria: 'Papelería', PuntoReorden: 5, Marketplace: 'SHEIN', MargenPct: 43.6, GananciaUnit: 65, ValorTotal: 14751, Estado: '🟢 OK' },
    { SKU: '783214469503', Producto: 'Tapete Foamy Infantil 4 Piezas Mix Colores', Stock: 10, PrecioCompra: 175, PrecioVenta: 489, Categoria: 'Tapetes Infantiles', PuntoReorden: 5, Marketplace: 'SHEIN', MargenPct: 64.2, GananciaUnit: 314, ValorTotal: 4890, Estado: '🟢 OK' },
    { SKU: '720595349444', Producto: 'Mancuerna Kit 2 Pesas 7 Libras Negro', Stock: 3, PrecioCompra: 110, PrecioVenta: 249, Categoria: 'Pesas', PuntoReorden: 5, Marketplace: 'SHEIN', MargenPct: 55.8, GananciaUnit: 139, ValorTotal: 747, Estado: '🟡 BAJO' },
    { SKU: '664554604536', Producto: 'Mesa Infantil 4 Sillas Plegable Blanco', Stock: 0, PrecioCompra: 480, PrecioVenta: 999, Categoria: 'Hogar', PuntoReorden: 5, Marketplace: 'SHEIN', MargenPct: 51.9, GananciaUnit: 519, ValorTotal: 0, Estado: '🔴 AGOTADO' },
    { SKU: '664554604444', Producto: 'Máquina Para Tortillas Prensa Manual Blanco', Stock: 32, PrecioCompra: 127, PrecioVenta: 199, Categoria: 'Cocina', PuntoReorden: 5, Marketplace: 'SHEIN', MargenPct: 36.2, GananciaUnit: 72, ValorTotal: 6368, Estado: '🟢 OK' },
    { SKU: '664554604475', Producto: 'Salseros Molcajete Kit 20 Piezas', Stock: 25, PrecioCompra: 81, PrecioVenta: 149, Categoria: 'Cocina', PuntoReorden: 5, Marketplace: 'SHEIN', MargenPct: 45.6, GananciaUnit: 68, ValorTotal: 3725, Estado: '🟢 OK' },
    { SKU: '749460136736', Producto: 'Tabla Flotante Natación Negro Tombstone', Stock: 6, PrecioCompra: 89, PrecioVenta: 229, Categoria: 'Natación', PuntoReorden: 5, Marketplace: 'SHEIN', MargenPct: 61.1, GananciaUnit: 140, ValorTotal: 1374, Estado: '🟡 BAJO' },
  ];
}

function generateDemoSales(inventory: InventoryItem[]): SaleItem[] {
  const sales: SaleItem[] = [];
  for (let d = 0; d < 30; d++) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0];
    inventory.forEach(item => {
      if (item.Stock === 0) return;
      if (Math.random() > 0.45) {
        const qty = Math.floor(Math.random() * 5) + 1;
        sales.push({
          SKU: item.SKU,
          Producto: item.Producto,
          Cantidad: qty,
          PrecioVenta: item.PrecioVenta,
          Total: qty * item.PrecioVenta,
          Fecha: dateStr,
          Marketplace: 'SHEIN',
        });
      }
    });
  }
  return sales;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [marketplace, setMarketplace] = useState<Marketplace>('SHEIN');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  });
  const [rawInventory, setRawInventory] = useState<InventoryItem[]>([]);
  const [rawSales, setRawSales] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingDemo, setUsingDemo] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUsingDemo(false);
    try {
      const invRes = await fetch(INVENTORY_URL);
      if (!invRes.ok) throw new Error(`Inventario HTTP ${invRes.status}`);
      const invData = await invRes.json();
      console.log('[YeshMarket] Raw inventory:', invData);

      const rawInv = Array.isArray(invData)
        ? invData
        : (invData.data || invData.items || invData.inventario || []);

      const invItems = normalizeInventory(rawInv);
      console.log('[YeshMarket] Inventario parseado:', invItems.length, 'productos');
      setRawInventory(invItems);

      // Ventas: intentar, si falla usar demo
      try {
        const salesRes = await fetch(SALES_URL);
        if (!salesRes.ok) throw new Error(`Ventas HTTP ${salesRes.status}`);
        const salesData = await salesRes.json();
        const rawSls = Array.isArray(salesData)
          ? salesData
          : (salesData.data || salesData.ordenes || salesData['órdenes'] || []);
        const saleItems = normalizeSales(rawSls, invItems);
        console.log('[YeshMarket] Ventas parseadas:', saleItems.length, 'registros');
        setRawSales(saleItems.length > 0 ? saleItems : generateDemoSales(invItems));
      } catch {
        console.warn('[YeshMarket] Ventas no disponibles, usando demo');
        setRawSales(generateDemoSales(invItems));
      }

    } catch (err) {
      console.error('[YeshMarket] Error:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setUsingDemo(true);
      const demoInv = generateDemoInventory();
      setRawInventory(demoInv);
      setRawSales(generateDemoSales(demoInv));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const inventory = marketplace === 'COMBINADO'
    ? mergeInventory(rawInventory)
    : rawInventory.filter(i => i.Marketplace === marketplace);

  const sales = (() => {
    let filtered = rawSales;
    if (dateRange.from) {
      const from = dateRange.from.toISOString().split('T')[0];
      filtered = filtered.filter(s => s.Fecha >= from);
    }
    if (dateRange.to) {
      const to = dateRange.to.toISOString().split('T')[0];
      filtered = filtered.filter(s => s.Fecha <= to);
    }
    if (marketplace === 'COMBINADO') return mergeSales(filtered);
    return filtered.filter(s => s.Marketplace === marketplace);
  })();

  return (
    <DataContext.Provider value={{
      marketplace, setMarketplace,
      dateRange, setDateRange,
      inventory, sales,
      loading, error, usingDemo,
      refreshData: fetchData,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
