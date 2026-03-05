import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';

export type Marketplace = 'SHEIN' | 'TIKTOK' | 'COMBINADO';
export interface DateRange { from: Date | undefined; to: Date | undefined; }

export interface InventoryItem {
  SKU: string; Producto: string; Stock: number;
  PrecioCompra: number; PrecioVenta: number; Categoria: string;
  PuntoReorden: number; Marketplace: string; MargenPct: number;
  GananciaUnit: number; ValorTotal: number; Estado: string;
  [key: string]: string | number;
}

export interface SaleItem {
  SKU: string; Producto: string; Cantidad: number;
  PrecioVenta: number; Total: number; Costo: number;
  Utilidad: number; Fecha: string; Marketplace: string;
  [key: string]: string | number;
}

interface DataContextType {
  marketplace: Marketplace; setMarketplace: (m: Marketplace) => void;
  dateRange: DateRange; setDateRange: (r: DateRange) => void;
  inventory: InventoryItem[]; sales: SaleItem[];
  loading: boolean; error: string | null; usingDemo: boolean;
  refreshData: () => void;
}

const DataContext = createContext<DataContextType | null>(null);

// ── API endpoints ────────────────────────────────────────────────
const SHEIN_INV_URL  = 'https://script.google.com/macros/s/AKfycbweOy2ly59Fir1sT1lmWAaCL2oFXnxu6f2Ba9EFKHDfkYuOQVrQEG_NKFKfLgb6AqET/exec?action=inventario';
const TIKTOK_BASE    = 'https://script.google.com/macros/s/AKfycby4hH7qI9rkFh5yOZ1ZYD2NBF9fki4tlLP9Tjat1QnZO3sVJHxuCKZDvFfr7l4zACAw/exec';
const TIKTOK_INV_URL = `${TIKTOK_BASE}?action=inventario`;
const TIKTOK_ORD_URL = `${TIKTOK_BASE}?action=%C3%B3rdenes`;

// ── Categoría ────────────────────────────────────────────────────
function inferCategoria(n: string): string {
  const s = n.toLowerCase();
  if (s.includes('tapete') && s.includes('yoga')) return 'Yoga & Fitness';
  if (s.includes('tapete') && s.includes('foamy')) return 'Tapetes Infantiles';
  if (s.includes('tapete') && s.includes('gym'))  return 'Gym';
  if (s.includes('mancuerna') || s.includes('pesa')) return 'Pesas';
  if (s.includes('caja') && s.includes('plástica')) return 'Almacenamiento';
  if (s.includes('papel') || s.includes('cartulina') || s.includes('opalina')) return 'Papelería';
  if (s.includes('tabla') && s.includes('natación')) return 'Natación';
  if (s.includes('bote') || s.includes('basura')) return 'Hogar';
  if (s.includes('organizador') || s.includes('mesa') || s.includes('silla')) return 'Hogar';
  if (s.includes('tortilla') || s.includes('salsero')) return 'Cocina';
  return 'General';
}

// ── Normaliza inventario (SHEIN o TikTok — misma estructura) ─────
// Campos reales: "Nombre", "SKU", "Stock", "Precio MXN",
//                "✏️ Costo Unitario", "Ganancia Unit.", "Margen %", "Estado"
function normalizeInventory(raw: any[], mp: string): InventoryItem[] {
  return raw.filter(r =>
    r['ID Producto'] && r['ID Producto'] !== 'TOTALES' &&
    r['Nombre'] && r['SKU'] !== '' && r['SKU'] != null
  ).map(r => ({
    SKU:          String(r['SKU'] || ''),
    Producto:     String(r['Nombre'] || ''),
    Stock:        Number(r['Stock'] || 0),
    PrecioCompra: Number(r['✏️ Costo Unitario'] || 0),
    PrecioVenta:  Number(r['Precio MXN'] || 0),
    Categoria:    inferCategoria(String(r['Nombre'] || '')),
    PuntoReorden: 5,
    Marketplace:  mp,
    MargenPct:    typeof r['Margen %'] === 'number' ? r['Margen %'] : 0,
    GananciaUnit: Number(r['Ganancia Unit.'] || 0),
    ValorTotal:   Number(r['Valor Total'] || 0),
    Estado:       String(r['Estado'] || ''),
  }));
}

// ── Normaliza ventas de TikTok ───────────────────────────────────
// Campos reales: "ID Orden", "Estado", "Fecha", "Producto",
//                "SKU", "SKU ID", "Cantidad", "💚 LIQUIDACION",
//                "✏️ Otros Costos", "Costo Mercancía", "💰 UTILIDAD REAL"
function normalizeTiktokSales(raw: any[]): SaleItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(r => {
      const estado = String(r['Estado'] || '');
      const liq    = r['💚 LIQUIDACION'];
      return (estado === 'COMPLETED' || estado === 'DELIVERED') &&
             typeof liq === 'number' && liq > 0;
    })
    .map(r => {
      const cantidad    = Number(r['Cantidad'] || 1);
      const liquidacion = Number(r['💚 LIQUIDACION'] || 0);
      const costo       = Number(r['Costo Mercancía'] || 0);
      const utilidad    = Number(r['💰 UTILIDAD REAL'] || liquidacion - costo);
      const skuId       = String(r['SKU ID'] || r['SKU'] || '');
      const fecha       = String(r['Fecha'] || '').split('T')[0].substring(0, 10);
      return {
        SKU:        skuId.substring(0, 13),   // usar primeros 13 dígitos del ID
        Producto:   String(r['Producto'] || '').replace(/ x\d+$/, ''),
        Cantidad:   cantidad,
        PrecioVenta: liquidacion,
        Total:      liquidacion,
        Costo:      costo,
        Utilidad:   utilidad,
        Fecha:      fecha,
        Marketplace: 'TIKTOK',
      };
    });
}

// ── Normaliza ventas de SHEIN ────────────────────────────────────
function normalizeSheinSales(raw: any[], inv: InventoryItem[]): SaleItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(r => r.SKU || r.sku)
    .map(r => {
      const sku      = String(r.SKU || r.sku || '');
      const cantidad = Number(r.Cantidad || r.UnidadesVendidas || 1);
      const item     = inv.find(i => i.SKU === sku);
      const precio   = Number(r.PrecioVenta || r['Precio MXN'] || item?.PrecioVenta || 0);
      const total    = Number(r.Total || cantidad * precio);
      const costo    = Number(r.Costo || item?.PrecioCompra || 0);
      return {
        SKU: sku, Producto: String(r.Producto || r.Nombre || item?.Producto || ''),
        Cantidad: cantidad, PrecioVenta: precio, Total: total,
        Costo: costo, Utilidad: total - costo * cantidad,
        Fecha: String(r.Fecha || '').split('T')[0],
        Marketplace: 'SHEIN',
      };
    })
    .filter(s => s.Cantidad > 0 && s.Total > 0);
}

// ── Merge COMBINADO ──────────────────────────────────────────────
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
    const ex  = map.get(key);
    if (ex) { ex.Cantidad += item.Cantidad; ex.Total += item.Total; ex.Utilidad += item.Utilidad; }
    else map.set(key, { ...item, Marketplace: 'COMBINADO' });
  });
  return Array.from(map.values());
}

// ── Demo data (productos reales) ─────────────────────────────────
function generateDemoInventory(mp: string): InventoryItem[] {
  return [
    { SKU:'664554604291', Producto:'Caja Plástica 55x36x37cm 54Lts Negro', Stock:11, PrecioCompra:136, PrecioVenta:269, Categoria:'Almacenamiento', PuntoReorden:5, Marketplace:mp, MargenPct:49.4, GananciaUnit:133, ValorTotal:2959, Estado:'🟢 OK' },
    { SKU:'783214469800', Producto:'Tapete Yoga 4MM Camello', Stock:41, PrecioCompra:42, PrecioVenta:99, Categoria:'Yoga & Fitness', PuntoReorden:5, Marketplace:mp, MargenPct:57.6, GananciaUnit:57, ValorTotal:4059, Estado:'🟢 OK' },
    { SKU:'664554605250', Producto:'Tapete Yoga 4MM Rosa', Stock:75, PrecioCompra:42, PrecioVenta:99, Categoria:'Yoga & Fitness', PuntoReorden:5, Marketplace:mp, MargenPct:57.6, GananciaUnit:57, ValorTotal:7425, Estado:'🟢 OK' },
    { SKU:'749460136637', Producto:'Papel Bond Blanco 500H Oficio', Stock:99, PrecioCompra:84, PrecioVenta:149, Categoria:'Papelería', PuntoReorden:5, Marketplace:mp, MargenPct:43.6, GananciaUnit:65, ValorTotal:14751, Estado:'🟢 OK' },
    { SKU:'783214469503', Producto:'Tapete Foamy Infantil 4pz 62x62 Mix', Stock:10, PrecioCompra:175, PrecioVenta:489, Categoria:'Tapetes Infantiles', PuntoReorden:5, Marketplace:mp, MargenPct:64.2, GananciaUnit:314, ValorTotal:4890, Estado:'🟢 OK' },
    { SKU:'720595349444', Producto:'Mancuerna Kit 2 Pesas 7 Libras Negro', Stock:3, PrecioCompra:110, PrecioVenta:249, Categoria:'Pesas', PuntoReorden:5, Marketplace:mp, MargenPct:55.8, GananciaUnit:139, ValorTotal:747, Estado:'🟡 BAJO' },
    { SKU:'664554604536', Producto:'Mesa Infantil 4 Sillas Plegable Blanco', Stock:0, PrecioCompra:480, PrecioVenta:999, Categoria:'Hogar', PuntoReorden:5, Marketplace:mp, MargenPct:51.9, GananciaUnit:519, ValorTotal:0, Estado:'🔴 AGOTADO' },
    { SKU:'664554604444', Producto:'Máquina Tortillas Prensa Manual', Stock:32, PrecioCompra:127, PrecioVenta:199, Categoria:'Cocina', PuntoReorden:5, Marketplace:mp, MargenPct:36.2, GananciaUnit:72, ValorTotal:6368, Estado:'🟢 OK' },
  ];
}

function generateDemoSales(inventory: InventoryItem[]): SaleItem[] {
  const sales: SaleItem[] = [];
  for (let d = 0; d < 30; d++) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0];
    inventory.filter(i => i.Stock > 0).forEach(item => {
      if (Math.random() > 0.5) {
        const qty = Math.floor(Math.random() * 3) + 1;
        const total = qty * item.PrecioVenta;
        const costo = qty * item.PrecioCompra;
        sales.push({ SKU: item.SKU, Producto: item.Producto, Cantidad: qty,
          PrecioVenta: item.PrecioVenta, Total: total, Costo: costo,
          Utilidad: total - costo, Fecha: dateStr, Marketplace: item.Marketplace });
      }
    });
  }
  return sales;
}

// ── Provider ─────────────────────────────────────────────────────
export function DataProvider({ children }: { children: ReactNode }) {
  const [marketplace, setMarketplace] = useState<Marketplace>('TIKTOK');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  });
  const [rawSheinInv,   setRawSheinInv]   = useState<InventoryItem[]>([]);
  const [rawTiktokInv,  setRawTiktokInv]  = useState<InventoryItem[]>([]);
  const [rawSheinSales, setRawSheinSales] = useState<SaleItem[]>([]);
  const [rawTiktokSales,setRawTiktokSales]= useState<SaleItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [usingDemo,setUsingDemo]= useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null); setUsingDemo(false);
    try {
      // ── SHEIN Inventario ────────────────────────────────────
      const sheinInvRes = await fetch(SHEIN_INV_URL);
      if (!sheinInvRes.ok) throw new Error(`SHEIN inv HTTP ${sheinInvRes.status}`);
      const sheinInvData = await sheinInvRes.json();
      const rawSI = Array.isArray(sheinInvData) ? sheinInvData : (sheinInvData.data || sheinInvData.inventario || []);
      const sheinInv = normalizeInventory(rawSI, 'SHEIN');
      setRawSheinInv(sheinInv);
      console.log('[YeshMarket] SHEIN inv:', sheinInv.length);

      // ── TikTok Inventario ───────────────────────────────────
      try {
        const tikInvRes = await fetch(TIKTOK_INV_URL);
        const tikInvData = await tikInvRes.json();
        const rawTI = Array.isArray(tikInvData) ? tikInvData : (tikInvData.data || tikInvData.inventario || []);
        const tikInv = normalizeInventory(rawTI, 'TIKTOK');
        setRawTiktokInv(tikInv);
        console.log('[YeshMarket] TikTok inv:', tikInv.length);
      } catch {
        console.warn('[YeshMarket] TikTok inv no disponible, usando SHEIN como base');
        setRawTiktokInv(sheinInv.map(i => ({ ...i, Marketplace: 'TIKTOK' })));
      }

      // ── SHEIN Ventas ────────────────────────────────────────
      try {
        const sheinOrdRes = await fetch(`https://script.google.com/macros/s/AKfycby4hH7qI9rkFh5yOZ1ZYD2NBF9fki4tlLP9Tjat1QnZO3sVJHxuCKZDvFfr7l4zACAw/exec?action=%C3%B3rdenes`);
        const sheinOrdData = await sheinOrdRes.json();
        const rawSO = Array.isArray(sheinOrdData) ? sheinOrdData : (sheinOrdData.ordenes || sheinOrdData['órdenes'] || []);
        const sheinSales = normalizeSheinSales(rawSO, sheinInv);
        setRawSheinSales(sheinSales.length > 0 ? sheinSales : generateDemoSales(sheinInv));
        console.log('[YeshMarket] SHEIN ventas:', sheinSales.length);
      } catch {
        console.warn('[YeshMarket] SHEIN ventas no disponibles');
        setRawSheinSales(generateDemoSales(sheinInv));
      }

      // ── TikTok Ventas ───────────────────────────────────────
      try {
        const tikOrdRes = await fetch(TIKTOK_ORD_URL);
        const tikOrdData = await tikOrdRes.json();
        const rawTO = Array.isArray(tikOrdData) ? tikOrdData : (tikOrdData.ordenes || tikOrdData['órdenes'] || []);
        const tikSales = normalizeTiktokSales(rawTO);
        setRawTiktokSales(tikSales.length > 0 ? tikSales : generateDemoSales(rawTiktokInv));
        console.log('[YeshMarket] TikTok ventas:', tikSales.length);
      } catch {
        console.warn('[YeshMarket] TikTok ventas no disponibles');
        setRawTiktokSales(generateDemoSales(rawTiktokInv));
      }

    } catch (err) {
      console.error('[YeshMarket] Error general:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setUsingDemo(true);
      const demoS = generateDemoInventory('SHEIN');
      const demoT = generateDemoInventory('TIKTOK');
      setRawSheinInv(demoS); setRawTiktokInv(demoT);
      setRawSheinSales(generateDemoSales(demoS));
      setRawTiktokSales(generateDemoSales(demoT));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Filtrar por marketplace ──────────────────────────────────
  const rawInventory = marketplace === 'COMBINADO'
    ? [...rawSheinInv, ...rawTiktokInv]
    : marketplace === 'SHEIN' ? rawSheinInv : rawTiktokInv;

  const rawSales = marketplace === 'COMBINADO'
    ? [...rawSheinSales, ...rawTiktokSales]
    : marketplace === 'SHEIN' ? rawSheinSales : rawTiktokSales;

  const inventory = marketplace === 'COMBINADO'
    ? mergeInventory(rawInventory) : rawInventory;

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
    return marketplace === 'COMBINADO' ? mergeSales(filtered) : filtered;
  })();

  return (
    <DataContext.Provider value={{
      marketplace, setMarketplace, dateRange, setDateRange,
      inventory, sales, loading, error, usingDemo,
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
