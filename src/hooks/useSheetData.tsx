import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
export type Marketplace = 'SHEIN' | 'TIKTOK' | 'COMBINADO';

export interface InventoryItem {
  SKU: string; Producto: string; Stock: number;
  PrecioCompra: number; PrecioVenta: number;
  Categoria: string; PuntoReorden: number;
  Marketplace: string; MargenPct: number;
  GananciaUnit: number; ValorTotal: number; Estado: string;
}

export interface SaleItem {
  IDOrden: string; SKU: string; Producto: string;
  Cantidad: number; PrecioVenta: number; Total: number;
  Costo: number; Utilidad: number; Margen: number;
  Fecha: string; Marketplace: string; Estado: string;
}

export interface DateRange { from: Date | undefined; to: Date | undefined; }

interface DataContextType {
  inventory: InventoryItem[]; sales: SaleItem[];
  marketplace: Marketplace; setMarketplace: (m: Marketplace) => void;
  dateRange: DateRange; setDateRange: (d: DateRange) => void;
  loading: boolean; error: string | null; usingDemo: boolean;
  refreshData: () => void;
}

const DataContext = createContext<DataContextType | null>(null);

// ─────────────────────────────────────────────────────────────
// ENDPOINTS
// URL_A → TikTok    URL_B → SHEIN
// ─────────────────────────────────────────────────────────────
const TIKTOK_BASE = 'https://script.google.com/macros/s/AKfycbweOy2ly59Fir1sT1lmWAaCL2oFXnxu6f2Ba9EFKHDfkYuOQVrQEG_NKFKfLgb6AqET/exec';
const SHEIN_BASE  = 'https://script.google.com/macros/s/AKfycby4hH7qI9rkFh5yOZ1ZYD2NBF9fki4tlLP9Tjat1QnZO3sVJHxuCKZDvFfr7l4zACAw/exec';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function inferCategoria(n: string): string {
  const s = n.toLowerCase();
  if (s.includes('tapete') && s.includes('yoga'))  return 'Yoga & Fitness';
  if (s.includes('tapete') && s.includes('foamy')) return 'Tapetes Infantiles';
  if (s.includes('tapete') && s.includes('gym'))   return 'Gym';
  if (s.includes('mancuerna') || s.includes('pesa')) return 'Pesas';
  if (s.includes('caja') && (s.includes('plástica') || s.includes('plastica'))) return 'Almacenamiento';
  if (s.includes('papel') || s.includes('cartulina') || s.includes('opalina')) return 'Papelería';
  if (s.includes('tabla') && s.includes('natación')) return 'Natación';
  if (s.includes('bote') || s.includes('basura')) return 'Hogar';
  if (s.includes('tortilla') || s.includes('salsero') || s.includes('molcajete')) return 'Cocina';
  return 'General';
}

function parseNum(v: any): number {
  if (v === null || v === undefined || v === '' || v === 'PENDIENTE') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const raw = String(v).trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d,.-]/g, '');
  if (!cleaned) return 0;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  let normalized = cleaned;
  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    const decimalSep = lastComma > lastDot ? ',' : '.';
    const thousandSep = decimalSep === ',' ? '.' : ',';
    normalized = cleaned.split(thousandSep).join('');
    if (decimalSep === ',') normalized = normalized.replace(/,/g, '.');
  } else if (hasComma && !hasDot) {
    normalized = cleaned.replace(/,/g, '.');
  }
  return parseFloat(normalized) || 0;
}

function normalizeText(v: any): string {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9_ ]+/g, ' ').trim();
}

function pickValue(row: Record<string, any>, keys: string[]): any {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return undefined;
}

function pickString(row: Record<string, any>, keys: string[]): string {
  const value = pickValue(row, keys);
  return value === undefined || value === null ? '' : String(value).trim();
}

function parseDate(v: any): string {
  if (!v) return '';
  const s = String(v).trim();
  // DD/MM/YYYY
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`;
  // YYYY-MM-DD HH:mm:ss
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  return s.split('T')[0].split(' ')[0];
}

// ─────────────────────────────────────────────────────────────
// NORMALIZE INVENTORY
// ─────────────────────────────────────────────────────────────
function normalizeInventory(raw: any[], mp: string): InventoryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(r => {
    const id = pickString(r, ['ID Producto', 'ID Producto (SKU SHEIN)', 'ID Producto(SKU SHEIN)', 'ID']);
    const nombre = pickString(r, ['Nombre', 'Producto (Nombre)', 'Producto']);
    return id && id !== 'TOTALES' && nombre && nombre !== 'TOTALES';
  }).map(r => {
    const stock = parseNum(pickValue(r, ['Stock', 'Stock Actual']));
    const precio = parseNum(pickValue(r, ['Precio MXN', 'Precio']));
    const costo = parseNum(pickValue(r, ['✏️ Costo Unitario', 'Costo Unitario', 'Costo']));
    const margen = parseNum(pickValue(r, ['Margen %', 'Margen']));
    const ganancia = parseNum(pickValue(r, ['Ganancia Unit.', 'Ganancia Unit', 'Ganancia']));
    const valorTotal = parseNum(pickValue(r, ['Valor Total'])) || stock * precio;
    const estado = String(pickValue(r, ['Estado']) || (stock === 0 ? '🔴 AGOTADO' : stock < 10 ? '🟡 BAJO' : '🟢 OK'));
    const skuRaw = pickString(r, ['SKU', 'SKU Interno', 'ID Producto', 'ID Producto (SKU SHEIN)']);
    const producto = pickString(r, ['Nombre', 'Producto (Nombre)', 'Producto']);
    return {
      SKU: skuRaw, Producto: producto,
      Stock: stock, PrecioCompra: costo, PrecioVenta: precio,
      Categoria: inferCategoria(producto),
      PuntoReorden: 5, Marketplace: mp, MargenPct: margen,
      GananciaUnit: ganancia, ValorTotal: valorTotal, Estado: estado,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// NORMALIZE ORDERS
// ─────────────────────────────────────────────────────────────
function isVenta(estado: string): boolean {
  const s = normalizeText(estado);
  const directStates = new Set(['COMPLETED', 'DELIVERED', 'SHIPPED']);
  if (directStates.has(s)) return true;
  return s.includes('ENTREGADA') || s.includes('ENVIADA') || s.includes('EN CAMINO');
}

// Build comprehensive lookup: ANY identifier → canonical SKU
function buildAllIdsMap(...rawInvArrays: any[][]): Map<string, string> {
  const map = new Map<string, string>();
  rawInvArrays.forEach(rawInv => {
    if (!Array.isArray(rawInv)) return;
    rawInv.forEach(r => {
      const canonicalSku = pickString(r, ['SKU', 'SKU Interno', 'ID Producto', 'ID Producto (SKU SHEIN)']);
      if (!canonicalSku || canonicalSku === 'TOTALES') return;
      // Map every possible identifier to this canonical SKU
      const ids = [
        pickString(r, ['ID Producto']),
        pickString(r, ['ID Producto (SKU SHEIN)', 'ID Producto(SKU SHEIN)']),
        pickString(r, ['SKU']),
        pickString(r, ['SKU Interno']),
      ];
      ids.forEach(id => {
        if (id && !isInvalidSku(id)) {
          map.set(id, canonicalSku);
        }
      });
    });
  });
  return map;
}

function isInvalidSku(sku: string): boolean {
  if (!sku) return true;
  const lower = sku.toLowerCase();
  return lower === '0' || lower === 'predeterminado' || lower === 'por defecto' || lower === 'default';
}

function normalizeOrders(raw: any[], mp: string, idMap?: Map<string, string>): SaleItem[] {
  if (!Array.isArray(raw)) return [];
  const dedup = new Set<string>();
  return raw
    .filter(r => {
      const orderId = pickString(r, ['ID Orden', 'Order ID', 'ID']);
      if (!orderId) return false;
      if (!isVenta(String(r['Estado'] || ''))) return false;
      const liq = parseNum(pickValue(r, ['💚 LIQUIDACION', '💚 Liquidación', 'Liquidación', 'Liquidacion', 'Total']));
      return liq > 0;
    })
    .map(r => {
      const liq = parseNum(pickValue(r, ['💚 LIQUIDACION', '💚 Liquidación', 'Liquidación', 'Liquidacion', 'Total']));
      const costo = parseNum(pickValue(r, ['Costo Mercancía', 'Costo Mercancia', 'Costo']));
      const util = parseNum(pickValue(r, ['💰 UTILIDAD REAL', 'Utilidad Real', 'Utilidad'])) || (liq - costo);
      const margen = parseNum(pickValue(r, ['Margen %', 'Margen'])) || (liq > 0 ? (util / liq) * 100 : 0);
      const qty = Math.max(1, parseNum(pickValue(r, ['Cantidad', 'Qty', 'QTY'])));
      const producto = pickString(r, ['Producto (Nombre)', 'Producto', 'Nombre']);
      const fecha = parseDate(pickValue(r, ['Fecha']));
      const idOrden = pickString(r, ['ID Orden', 'Order ID', 'ID']);

      // Try ALL identifiers from the order row against the comprehensive map
      const candidates = [
        pickString(r, ['SKU Interno']),
        pickString(r, ['SKU']),
        pickString(r, ['SKU ID']),
        pickString(r, ['ID Producto (SKU SHEIN)', 'ID Producto(SKU SHEIN)']),
        pickString(r, ['ID Producto']),
      ];
      let sku = '';
      for (const c of candidates) {
        if (!c || isInvalidSku(c)) continue;
        if (idMap && idMap.has(c)) { sku = idMap.get(c)!; break; }
        if (!sku) sku = c; // keep first valid as fallback
      }
      // If fallback sku exists but wasn't resolved, try map one more time
      if (sku && idMap && idMap.has(sku)) sku = idMap.get(sku)!;

      return {
        IDOrden: idOrden, SKU: sku, Producto: producto,
        Cantidad: qty, PrecioVenta: liq, Total: liq, Costo: costo,
        Utilidad: util, Margen: margen, Fecha: fecha,
        Marketplace: mp, Estado: String(r['Estado'] || ''),
      };
    })
    .filter(sale => {
      if (sale.Total <= 0) return false;
      const key = `${sale.IDOrden}|${sale.SKU}|${sale.Fecha}`;
      if (dedup.has(key)) return false;
      dedup.add(key);
      return true;
    });
}

// ─────────────────────────────────────────────────────────────
// DETECT & SWAP (auto-detect if endpoints return swapped data)
// ─────────────────────────────────────────────────────────────
function detectInventoryType(raw: any[]): 'SHEIN' | 'TIKTOK' | 'UNKNOWN' {
  if (!Array.isArray(raw) || raw.length === 0) return 'UNKNOWN';
  const sample = raw.slice(0, Math.min(15, raw.length));
  let sheinScore = 0, tiktokScore = 0;
  sample.forEach(r => {
    if (r['SKU Interno'] || r['ID Producto (SKU SHEIN)']) sheinScore += 2;
    if (r['SKU'] || r['ID Producto']) tiktokScore += 1;
  });
  if (sheinScore > tiktokScore) return 'SHEIN';
  if (tiktokScore > sheinScore) return 'TIKTOK';
  return 'UNKNOWN';
}

function detectOrdersType(raw: any[]): 'SHEIN' | 'TIKTOK' | 'UNKNOWN' {
  if (!Array.isArray(raw) || raw.length === 0) return 'UNKNOWN';
  const sample = raw.slice(0, Math.min(30, raw.length));
  let sheinScore = 0, tiktokScore = 0;
  sample.forEach(r => {
    const estado = normalizeText(r['Estado']);
    if (estado.includes('ENVIADA') || estado.includes('ENTREGADA')) sheinScore += 2;
    if (estado === 'COMPLETED' || estado === 'DELIVERED' || estado === 'AWAITING_SHIPMENT') tiktokScore += 2;
    if (r['SKU Interno']) sheinScore += 1;
    if (r['SKU ID']) tiktokScore += 1;
  });
  if (sheinScore > tiktokScore) return 'SHEIN';
  if (tiktokScore > sheinScore) return 'TIKTOK';
  return 'UNKNOWN';
}

// ─────────────────────────────────────────────────────────────
// MERGE
// ─────────────────────────────────────────────────────────────
function mergeInventory(items: InventoryItem[]): InventoryItem[] {
  const map = new Map<string, InventoryItem>();
  items.forEach(item => {
    const key = String(item.SKU || item.Producto);
    const ex = map.get(key);
    if (ex) { ex.Stock += item.Stock; ex.ValorTotal += item.ValorTotal; }
    else map.set(key, { ...item, Marketplace: 'COMBINADO' });
  });
  return Array.from(map.values());
}

// ─────────────────────────────────────────────────────────────
// DEMO FALLBACK
// ─────────────────────────────────────────────────────────────
function generateDemoInventory(mp: string): InventoryItem[] {
  return [
    { SKU:'664554604444', Producto:'Máquina Tortillas Prensa Manual', Stock:32, PrecioCompra:127, PrecioVenta:199, Categoria:'Cocina', PuntoReorden:5, Marketplace:mp, MargenPct:36.2, GananciaUnit:72, ValorTotal:6368, Estado:'🟢 OK' },
    { SKU:'783214469800', Producto:'Tapete Yoga 4MM Verde Agua', Stock:41, PrecioCompra:42, PrecioVenta:99, Categoria:'Yoga & Fitness', PuntoReorden:5, Marketplace:mp, MargenPct:57.6, GananciaUnit:57, ValorTotal:4059, Estado:'🟢 OK' },
    { SKU:'664554605250', Producto:'Tapete Yoga 4MM Rosa', Stock:75, PrecioCompra:42, PrecioVenta:99, Categoria:'Yoga & Fitness', PuntoReorden:5, Marketplace:mp, MargenPct:57.6, GananciaUnit:57, ValorTotal:7425, Estado:'🟢 OK' },
    { SKU:'749460136637', Producto:'Papel Bond Blanco 500H Oficio', Stock:99, PrecioCompra:84, PrecioVenta:149, Categoria:'Papelería', PuntoReorden:5, Marketplace:mp, MargenPct:43.6, GananciaUnit:65, ValorTotal:14751, Estado:'🟢 OK' },
    { SKU:'123456789012', Producto:'Caja Plástica Apilable 20L', Stock:3, PrecioCompra:35, PrecioVenta:79, Categoria:'Almacenamiento', PuntoReorden:5, Marketplace:mp, MargenPct:55.7, GananciaUnit:44, ValorTotal:237, Estado:'🔴 AGOTADO' },
    { SKU:'987654321098', Producto:'Mancuerna 5kg Par', Stock:8, PrecioCompra:120, PrecioVenta:249, Categoria:'Pesas', PuntoReorden:5, Marketplace:mp, MargenPct:51.8, GananciaUnit:129, ValorTotal:1992, Estado:'🟡 BAJO' },
    { SKU:'456789012345', Producto:'Tabla Natación Espuma', Stock:15, PrecioCompra:45, PrecioVenta:99, Categoria:'Natación', PuntoReorden:5, Marketplace:mp, MargenPct:54.5, GananciaUnit:54, ValorTotal:1485, Estado:'🟢 OK' },
    { SKU:'321098765432', Producto:'Bote Basura 50L Pedal', Stock:2, PrecioCompra:89, PrecioVenta:179, Categoria:'Hogar', PuntoReorden:5, Marketplace:mp, MargenPct:50.3, GananciaUnit:90, ValorTotal:358, Estado:'🔴 AGOTADO' },
  ];
}

function generateDemoSales(inventory: InventoryItem[], mp: string): SaleItem[] {
  const sales: SaleItem[] = [];
  const today = new Date();
  for (let d = 0; d < 60; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0];
    const items = inventory.slice(0, Math.min(5, inventory.length));
    items.forEach(item => {
      if (Math.random() < 0.4) return;
      const qty = Math.ceil(Math.random() * 3);
      const total = qty * item.PrecioVenta;
      const costo = qty * item.PrecioCompra;
      sales.push({
        IDOrden: `DEMO-${d}-${item.SKU}`, SKU: item.SKU, Producto: item.Producto,
        Cantidad: qty, PrecioVenta: item.PrecioVenta, Total: total, Costo: costo,
        Utilidad: total - costo, Margen: total > 0 ? ((total - costo) / total) * 100 : 0,
        Fecha: dateStr, Marketplace: mp, Estado: 'COMPLETED',
      });
    });
  }
  return sales;
}

// ─────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────
export function DataProvider({ children }: { children: ReactNode }) {
  const [marketplace, setMarketplace] = useState<Marketplace>('TIKTOK');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().setDate(new Date().getDate() - 90)),
    to: new Date(),
  });
  const [rawSheinInv, setRawSheinInv] = useState<InventoryItem[]>([]);
  const [rawTiktokInv, setRawTiktokInv] = useState<InventoryItem[]>([]);
  const [rawSheinSales, setRawSheinSales] = useState<SaleItem[]>([]);
  const [rawTiktokSales, setRawTiktokSales] = useState<SaleItem[]>([]);
  const [hasTiktokData, setHasTiktokData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingDemo, setUsingDemo] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null); setUsingDemo(false);
    setHasTiktokData(false);

    let rawTiktokInvArr: any[] = [];
    let rawSheinInvArr: any[] = [];
    let rawTiktokOrdersArr: any[] = [];
    let rawSheinOrdersArr: any[] = [];

    try {
      const r = await fetch(`${TIKTOK_BASE}?action=inventario`);
      const d = await r.json();
      rawTiktokInvArr = Array.isArray(d) ? d : (d.data || []);
      console.log('[YM] TikTok inv raw:', rawTiktokInvArr.length, rawTiktokInvArr[0]);
    } catch(e) { console.warn('[YM] TikTok inv error:', e); }

    try {
      const r = await fetch(`${TIKTOK_BASE}?action=ordenes`);
      const d = await r.json();
      rawTiktokOrdersArr = Array.isArray(d) ? d : (d.data || []);
      console.log('[YM] TikTok órdenes raw:', rawTiktokOrdersArr.length, rawTiktokOrdersArr[0]);
    } catch(e) { console.warn('[YM] TikTok ordenes error:', e); }

    try {
      const r = await fetch(`${SHEIN_BASE}?action=inventario`);
      const d = await r.json();
      rawSheinInvArr = Array.isArray(d) ? d : (d.data || []);
      console.log('[YM] SHEIN inv raw:', rawSheinInvArr.length, rawSheinInvArr[0]);
    } catch(e) { console.warn('[YM] SHEIN inv error:', e); }

    try {
      const r = await fetch(`${SHEIN_BASE}?action=ordenes`);
      const d = await r.json();
      rawSheinOrdersArr = Array.isArray(d) ? d : (d.data || []);
      console.log('[YM] SHEIN órdenes raw:', rawSheinOrdersArr.length, rawSheinOrdersArr[0]);
    } catch(e) { console.warn('[YM] SHEIN ordenes error:', e); }

    // Auto-detect if data is swapped between endpoints
    const tiktokInvType = detectInventoryType(rawTiktokInvArr);
    const sheinInvType = detectInventoryType(rawSheinInvArr);
    const tiktokOrdersType = detectOrdersType(rawTiktokOrdersArr);
    const sheinOrdersType = detectOrdersType(rawSheinOrdersArr);

    const shouldSwapInv = tiktokInvType === 'SHEIN' && sheinInvType === 'TIKTOK';
    const shouldSwapOrders = tiktokOrdersType === 'SHEIN' && sheinOrdersType === 'TIKTOK';

    const finalTiktokInvRaw = shouldSwapInv ? rawSheinInvArr : rawTiktokInvArr;
    const finalSheinInvRaw = shouldSwapInv ? rawTiktokInvArr : rawSheinInvArr;
    const finalTiktokOrdersRaw = shouldSwapOrders ? rawSheinOrdersArr : rawTiktokOrdersArr;
    const finalSheinOrdersRaw = shouldSwapOrders ? rawTiktokOrdersArr : rawSheinOrdersArr;

    // Build comprehensive ID→SKU maps from BOTH inventories
    const allIdsMap = buildAllIdsMap(finalTiktokInvRaw, finalSheinInvRaw);

    let tiktokInv = normalizeInventory(finalTiktokInvRaw, 'TIKTOK');
    let sheinInv = normalizeInventory(finalSheinInvRaw, 'SHEIN');
    let tiktokSales = normalizeOrders(finalTiktokOrdersRaw, 'TIKTOK', allIdsMap);
    let sheinSales = normalizeOrders(finalSheinOrdersRaw, 'SHEIN', allIdsMap);

    console.log('[YM] allIdsMap size:', allIdsMap.size);
    console.log('[YM] sample sales SKUs TikTok:', tiktokSales.slice(0, 5).map(s => s.SKU));
    console.log('[YM] sample sales SKUs SHEIN:', sheinSales.slice(0, 5).map(s => s.SKU));
    console.log('[YM] sample inv SKUs TikTok:', tiktokInv.slice(0, 5).map(i => i.SKU));
    console.log('[YM] sample inv SKUs SHEIN:', sheinInv.slice(0, 5).map(i => i.SKU));

    const anySuccess = tiktokInv.length > 0 || sheinInv.length > 0;
    if (tiktokSales.length > 0) setHasTiktokData(true);

    console.log('[YM] inv swap?', shouldSwapInv, 'orders swap?', shouldSwapOrders);
    console.log('[YM] final inv → TikTok:', tiktokInv.length, 'SHEIN:', sheinInv.length);
    console.log('[YM] final ord → TikTok:', tiktokSales.length, 'SHEIN:', sheinSales.length);

    if (!anySuccess) {
      const dS = generateDemoInventory('SHEIN'), dT = generateDemoInventory('TIKTOK');
      setRawSheinInv(dS); setRawTiktokInv(dT);
      setRawSheinSales(generateDemoSales(dS, 'SHEIN'));
      setRawTiktokSales(generateDemoSales(dT, 'TIKTOK'));
      setUsingDemo(true); setLoading(false); return;
    }

    if (sheinInv.length === 0 && tiktokInv.length > 0)
      sheinInv = tiktokInv.map(i => ({ ...i, Marketplace: 'SHEIN' }));
    if (tiktokInv.length === 0 && sheinInv.length > 0)
      tiktokInv = sheinInv.map(i => ({ ...i, Marketplace: 'TIKTOK' }));

    setRawSheinInv(sheinInv); setRawTiktokInv(tiktokInv);
    setRawSheinSales(sheinSales); setRawTiktokSales(tiktokSales);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filterByDate = useCallback((items: SaleItem[]) => {
    if (!dateRange.from && !dateRange.to) return items;
    return items.filter(s => {
      if (!s.Fecha) return true;
      const d = new Date(s.Fecha + 'T12:00:00');
      if (dateRange.from && d < dateRange.from) return false;
      if (dateRange.to && d > dateRange.to) return false;
      return true;
    });
  }, [dateRange]);

  const { inventory, sales } = (() => {
    switch (marketplace) {
      case 'SHEIN':    return { inventory: rawSheinInv, sales: filterByDate(rawSheinSales) };
      case 'TIKTOK':   return { inventory: rawTiktokInv, sales: filterByDate(rawTiktokSales) };
      case 'COMBINADO':
        return {
          inventory: mergeInventory([...rawSheinInv, ...rawTiktokInv]),
          sales: filterByDate([...rawSheinSales, ...rawTiktokSales]),
        };
    }
  })();

  return (
    <DataContext.Provider value={{
      inventory, sales, marketplace, setMarketplace,
      dateRange, setDateRange, loading, error, usingDemo,
      refreshData: fetchData,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be inside DataProvider');
  return ctx;
}
