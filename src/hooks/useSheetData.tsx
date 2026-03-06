// URL_A → 839 filas, Estado: COMPLETED/DELIVERED  → TikTok
// URL_B → 287 filas, Estado: 🚚 Enviada           → SHEIN
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
  if (typeof v === 'number') return v;
  return parseFloat(String(v).replace(/[$,\s]/g, '')) || 0;
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
  return String(v || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9_ ]+/g, ' ')
    .trim();
}

function pickString(row: Record<string, any>, keys: string[]): string {
  const value = pickValue(row, keys);
  return value === undefined || value === null ? '' : String(value).trim();
}

function parseDate(v: any): string {
  if (!v) return '';
  const s = String(v);
  const s = String(v).trim();

  // DD/MM/YYYY
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`;

  // YYYY-MM-DD HH:mm:ss
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;

  // ISO con T
  return s.split('T')[0];
  return s.split('T')[0].split(' ')[0];
}

// ─────────────────────────────────────────────────────────────
// NORMALIZAR INVENTARIO
// Cols: ID Producto, Nombre, SKU, Stock, Precio MXN,
//       ✏️ Costo Unitario, Valor Total, Ganancia Unit., Margen %, Estado
// ─────────────────────────────────────────────────────────────
function normalizeInventory(raw: any[], mp: string): InventoryItem[] {
  return raw.filter(r => {
    const id     = String(r['ID Producto'] || '').trim();
    const nombre = String(r['Nombre'] || '').trim();
    const id = pickString(r, ['ID Producto', 'ID Producto (SKU SHEIN)', 'ID Producto(SKU SHEIN)', 'ID']);
    const nombre = pickString(r, ['Nombre', 'Producto (Nombre)', 'Producto']);
    return id && id !== 'TOTALES' && nombre && nombre !== 'TOTALES';
  }).map(r => {
    const stock      = parseNum(r['Stock']);
    const precio     = parseNum(r['Precio MXN']);
    const costo      = parseNum(r['✏️ Costo Unitario']);
    const margen     = parseNum(r['Margen %']);
    const ganancia   = parseNum(r['Ganancia Unit.']);
    const valorTotal = parseNum(r['Valor Total']) || stock * precio;
    const estado     = String(r['Estado'] || (stock === 0 ? '🔴 AGOTADO' : stock < 10 ? '🟡 BAJO' : '🟢 OK'));
    const skuRaw = String(r['SKU'] ?? r['ID Producto'] ?? '').trim();
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
      SKU: skuRaw, Producto: String(r['Nombre'] || ''),
      SKU: skuRaw, Producto: producto,
      Stock: stock, PrecioCompra: costo, PrecioVenta: precio,
      Categoria: inferCategoria(String(r['Nombre'] || '')),
      Categoria: inferCategoria(producto),
      PuntoReorden: 5, Marketplace: mp, MargenPct: margen,
      GananciaUnit: ganancia, ValorTotal: valorTotal, Estado: estado,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// NORMALIZAR ÓRDENES
// TikTok: Estado = COMPLETED | DELIVERED  | cols: Producto, SKU
// SHEIN:  Estado = 🚚 Enviada | ✅ Entregada | cols: "Producto (Nombre)", "SKU Interno"
// ─────────────────────────────────────────────────────────────
function isVenta(estado: string): boolean {
  const s = estado.toUpperCase();
  if (s === 'COMPLETED' || s === 'DELIVERED') return true;
  if (s.includes('ENTREGADA') || s.includes('ENVIADA') || s.includes('EN CAMINO')) return true;
  return false;
  const s = normalizeText(estado);
  const directStates = new Set(['COMPLETED', 'DELIVERED', 'SHIPPED']);
  if (directStates.has(s)) return true;
  return s.includes('ENTREGADA') || s.includes('ENVIADA');
}

function pickValue(row: Record<string, any>, keys: string[]): any {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return undefined;
}

function normalizeOrders(raw: any[], mp: string): SaleItem[] {
  if (!Array.isArray(raw)) return [];

  const dedup = new Set<string>();
  return raw
    .filter(r => {
      if (!r['ID Orden']) return false;
      const orderId = pickString(r, ['ID Orden', 'Order ID', 'ID']);
      if (!orderId) return false;
      if (!isVenta(String(r['Estado'] || ''))) return false;
      return parseNum(r['💚 LIQUIDACION']) > 0;
      const liq = parseNum(pickValue(r, ['💚 LIQUIDACION', '💚 Liquidación', 'Liquidación', 'Liquidacion', 'Total']));
      return liq > 0;
    })
    .map(r => {
      const liq     = parseNum(r['💚 LIQUIDACION']);
      const costo   = parseNum(r['Costo Mercancía']);
      const util    = parseNum(r['💰 UTILIDAD REAL']) || (liq - costo);
      const margen  = parseNum(r['Margen %']) || (liq > 0 ? (util / liq) * 100 : 0);
      const qty     = Math.max(1, parseNum(r['Cantidad']));
      const producto = String(r['Producto (Nombre)'] || r['Producto'] || '');
      const sku      = String(r['SKU Interno'] || r['SKU'] || r['SKU ID'] || '');
      const liq = parseNum(pickValue(r, ['💚 LIQUIDACION', '💚 Liquidación', 'Liquidación', 'Liquidacion', 'Total']));
      const costo = parseNum(pickValue(r, ['Costo Mercancía', 'Costo Mercancia', 'Costo']));
      const util = parseNum(pickValue(r, ['💰 UTILIDAD REAL', 'Utilidad Real', 'Utilidad'])) || (liq - costo);
      const margen = parseNum(pickValue(r, ['Margen %', 'Margen'])) || (liq > 0 ? (util / liq) * 100 : 0);
      const qty = Math.max(1, parseNum(pickValue(r, ['Cantidad', 'Qty', 'QTY'])));
      const producto = pickString(r, ['Producto (Nombre)', 'Producto', 'Nombre']);
      const sku = pickString(r, ['SKU Interno', 'SKU', 'SKU ID']);
      const fecha = parseDate(r['Fecha']);
      const idOrden = pickString(r, ['ID Orden', 'Order ID', 'ID']);
      return {
        IDOrden: String(r['ID Orden']), SKU: sku, Producto: producto,
        IDOrden: idOrden, SKU: sku, Producto: producto,
        Cantidad: qty, PrecioVenta: liq, Total: liq, Costo: costo,
        Utilidad: util, Margen: margen, Fecha: parseDate(r['Fecha']),
        Utilidad: util, Margen: margen, Fecha: fecha,
        Marketplace: mp, Estado: String(r['Estado'] || ''),
      };
    })
    .filter(s => s.Total > 0);
    .filter(sale => {
      if (sale.Total <= 0) return false;
      const key = `${sale.IDOrden}|${sale.SKU}|${sale.Fecha}`;
      if (dedup.has(key)) return false;
      dedup.add(key);
      return true;
    });
}

// ─────────────────────────────────────────────────────────────
// MERGE
// ─────────────────────────────────────────────────────────────
function mergeInventory(items: InventoryItem[]): InventoryItem[] {
  const map = new Map<string, InventoryItem>();
  items.forEach(item => {
    const key = String(item.SKU || item.Producto);
    const ex  = map.get(key);
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
@@ -185,102 +247,96 @@ function generateDemoSales(inventory: InventoryItem[], mp: string): SaleItem[] {
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
    to:   new Date(),
  });
  const [rawSheinInv,    setRawSheinInv]    = useState<InventoryItem[]>([]);
  const [rawTiktokInv,   setRawTiktokInv]   = useState<InventoryItem[]>([]);
  const [rawSheinSales,  setRawSheinSales]  = useState<SaleItem[]>([]);
  const [rawTiktokSales, setRawTiktokSales] = useState<SaleItem[]>([]);
  const [hasTiktokData,  setHasTiktokData]  = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [usingDemo, setUsingDemo] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null); setUsingDemo(false);
    setHasTiktokData(false);
    let sheinInv: InventoryItem[] = [], tiktokInv: InventoryItem[] = [];
    let sheinSales: SaleItem[] = [], tiktokSales: SaleItem[] = [];
    let anySuccess = false;

    try {
      const r = await fetch(`${TIKTOK_BASE}?action=inventario`);
      const d = await r.json();
      tiktokInv = normalizeInventory(Array.isArray(d) ? d : (d.data || []), 'TIKTOK');
      if (tiktokInv.length > 0) anySuccess = true;
      console.log('[YM] TikTok inv:', tiktokInv.length);
    } catch(e) { console.warn('[YM] TikTok inv error:', e); }

    try {
      const r = await fetch(`${TIKTOK_BASE}?action=ordenes`);
      const d = await r.json();
      const raw = Array.isArray(d) ? d : (d.data || []);
      tiktokSales = normalizeOrders(raw, 'TIKTOK');
      if (tiktokSales.length > 0) setHasTiktokData(true);
      console.log('[YM] TikTok órdenes raw:', raw.length, '→ ventas:', tiktokSales.length);
    } catch(e) { console.warn('[YM] TikTok ordenes error:', e); }

    try {
      const r = await fetch(`${SHEIN_BASE}?action=inventario`);
      const d = await r.json();
      sheinInv = normalizeInventory(Array.isArray(d) ? d : (d.data || []), 'SHEIN');
      if (sheinInv.length > 0) anySuccess = true;
      console.log('[YM] SHEIN inv:', sheinInv.length);
    } catch(e) { console.warn('[YM] SHEIN inv error:', e); }

    try {
      const r = await fetch(`${SHEIN_BASE}?action=ordenes`);
      const d = await r.json();
      const raw = Array.isArray(d) ? d : (d.data || []);
      sheinSales = normalizeOrders(raw, 'SHEIN');
      console.log('[YM] SHEIN órdenes raw:', raw.length, '→ ventas:', sheinSales.length);
    } catch(e) { console.warn('[YM] SHEIN ordenes error:', e); }

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
    if (sheinSales.length === 0 && sheinInv.length > 0)
      sheinSales = generateDemoSales(sheinInv, 'SHEIN');

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
      if (dateRange.to   && d > dateRange.to)   return false;
      return true;
    });
  }, [dateRange]);

  const { inventory, sales } = (() => {
    switch (marketplace) {
      case 'SHEIN':    return { inventory: rawSheinInv,  sales: filterByDate(rawSheinSales) };
      case 'TIKTOK':   return { inventory: rawTiktokInv, sales: filterByDate(rawTiktokSales) };
      case 'COMBINADO':
        return {
          inventory: mergeInventory([...rawSheinInv, ...rawTiktokInv]),
