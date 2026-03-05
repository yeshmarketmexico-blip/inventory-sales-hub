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
  refreshData: () => void;
}

const DataContext = createContext<DataContextType | null>(null);

const INVENTORY_URL = 'https://script.google.com/macros/s/AKfycbweOy2ly59Fir1sT1lmWAaCL2oFXnxu6f2Ba9EFKHDfkYuOQVrQEG_NKFKfLgb6AqET/exec?action=inventario';
const SALES_URL = 'https://script.google.com/macros/s/AKfycby4hH7qI9rkFh5yOZ1ZYD2NBF9fki4tlLP9Tjat1QnZO3sVJHxuCKZDvFfr7l4zACAw/exec?action=ordenes';

function normalizeInventory(raw: any[]): InventoryItem[] {
  return raw.map(r => ({
    SKU: r.SKU || r.sku || '',
    Producto: r.Producto || r.Nombre || r.nombre || '',
    Stock: Number(r.Stock || r.stock || 0),
    PrecioCompra: Number(r.PrecioCompra || r.CostoUnitario || r.costoUnitario || r.Costo || 0),
    PrecioVenta: Number(r.PrecioVenta || r.PrecioMXN || r.precioMXN || r.Precio || 0),
    Categoria: r.Categoria || r.categoria || r.Categoría || '',
    PuntoReorden: Number(r.PuntoReorden || r.puntoReorden || r.Reorden || 10),
    Marketplace: (r.Marketplace || r.Canal || r.canal || 'SHEIN').toString().toUpperCase(),
  }));
}

function normalizeSales(raw: any[], inventory: InventoryItem[]): SaleItem[] {
  return raw.map(r => {
    const sku = r.SKU || r.sku || '';
    const cantidad = Number(r.Cantidad || r.UnidadesVendidas || r.unidadesVendidas || 0);
    const inv = inventory.find(i => i.SKU === sku);
    const precio = Number(r.PrecioVenta || r.PrecioMXN || inv?.PrecioVenta || 0);
    return {
      SKU: sku,
      Producto: r.Producto || r.Nombre || inv?.Producto || '',
      Cantidad: cantidad,
      PrecioVenta: precio,
      Total: Number(r.Total || r.total || cantidad * precio),
      Fecha: r.Fecha || r.fecha || '',
      Marketplace: (r.Marketplace || r.Canal || r.canal || 'SHEIN').toString().toUpperCase(),
    };
  });
}

function mergeData(items: InventoryItem[]): InventoryItem[] {
  const map = new Map<string, InventoryItem>();
  items.forEach(item => {
    const existing = map.get(item.SKU);
    if (existing) {
      existing.Stock += item.Stock;
    } else {
      map.set(item.SKU, { ...item, Marketplace: 'COMBINADO' });
    }
  });
  return Array.from(map.values());
}

function mergeSales(items: SaleItem[]): SaleItem[] {
  const map = new Map<string, SaleItem>();
  items.forEach(item => {
    const key = `${item.SKU}-${item.Fecha}`;
    const existing = map.get(key);
    if (existing) {
      existing.Cantidad += item.Cantidad;
      existing.Total += item.Total;
    } else {
      map.set(key, { ...item, Marketplace: 'COMBINADO' });
    }
  });
  return Array.from(map.values());
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [marketplace, setMarketplace] = useState<Marketplace>('COMBINADO');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  });
  const [rawInventory, setRawInventory] = useState<InventoryItem[]>([]);
  const [rawSales, setRawSales] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, salesRes] = await Promise.all([
        fetch(INVENTORY_URL),
        fetch(SALES_URL),
      ]);
      
      if (!invRes.ok || !salesRes.ok) throw new Error('Error al cargar datos');
      
      const invData = await invRes.json();
      const salesData = await salesRes.json();
      
      console.log('[StockPulse] Raw inventory response:', invData);
      console.log('[StockPulse] Raw sales response:', salesData);
      
      const rawInv = Array.isArray(invData) ? invData : (invData.data || invData.items || invData.inventario || []);
      const rawSls = Array.isArray(salesData) ? salesData : (salesData.data || salesData.items || salesData.ordenes || []);
      
      const invItems = normalizeInventory(rawInv);
      const saleItems = normalizeSales(rawSls, invItems);
      
      console.log('[StockPulse] Normalized inventory:', invItems.length, 'items');
      console.log('[StockPulse] Normalized sales:', saleItems.length, 'records');
      
      setRawInventory(invItems);
      setRawSales(saleItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      // Set demo data for development
      setRawInventory(generateDemoInventory());
      setRawSales(generateDemoSales());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter by marketplace
  const inventory = marketplace === 'COMBINADO'
    ? mergeData(rawInventory)
    : rawInventory.filter(i => i.Marketplace?.toUpperCase() === marketplace);

  // Filter by date range and marketplace
  const sales = (() => {
    let filtered = rawSales;
    if (dateRange.from) {
      filtered = filtered.filter(s => new Date(s.Fecha) >= dateRange.from!);
    }
    if (dateRange.to) {
      filtered = filtered.filter(s => new Date(s.Fecha) <= dateRange.to!);
    }
    if (marketplace === 'COMBINADO') {
      return mergeSales(filtered);
    }
    return filtered.filter(s => s.Marketplace?.toUpperCase() === marketplace);
  })();

  return (
    <DataContext.Provider value={{
      marketplace, setMarketplace,
      dateRange, setDateRange,
      inventory, sales,
      loading, error,
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

// Demo data generators
function generateDemoInventory(): InventoryItem[] {
  const products = [
    { name: 'Blusa Floral', cat: 'Ropa', price: 15, sell: 35 },
    { name: 'Pantalón Cargo', cat: 'Ropa', price: 20, sell: 45 },
    { name: 'Vestido Midi', cat: 'Ropa', price: 18, sell: 55 },
    { name: 'Collar Perlas', cat: 'Accesorios', price: 5, sell: 18 },
    { name: 'Bolso Tote', cat: 'Accesorios', price: 12, sell: 32 },
    { name: 'Zapatos Platform', cat: 'Calzado', price: 22, sell: 48 },
    { name: 'Gorra Vintage', cat: 'Accesorios', price: 8, sell: 22 },
    { name: 'Falda Plisada', cat: 'Ropa', price: 14, sell: 38 },
    { name: 'Aretes Dorados', cat: 'Accesorios', price: 3, sell: 12 },
    { name: 'Sudadera Oversize', cat: 'Ropa', price: 16, sell: 42 },
    { name: 'Cinturón Cuero', cat: 'Accesorios', price: 10, sell: 28 },
    { name: 'Top Crop', cat: 'Ropa', price: 9, sell: 25 },
  ];
  
  const items: InventoryItem[] = [];
  products.forEach((p, i) => {
    ['SHEIN', 'TIKTOK'].forEach(mp => {
      items.push({
        SKU: `SKU-${String(i + 1).padStart(3, '0')}`,
        Producto: p.name,
        Stock: Math.floor(Math.random() * 150) + 10,
        PrecioCompra: p.price,
        PrecioVenta: p.sell + (mp === 'TIKTOK' ? 5 : 0),
        Categoria: p.cat,
        PuntoReorden: Math.floor(Math.random() * 20) + 5,
        Marketplace: mp,
      });
    });
  });
  return items;
}

function generateDemoSales(): SaleItem[] {
  const skus = Array.from({ length: 12 }, (_, i) => `SKU-${String(i + 1).padStart(3, '0')}`);
  const names = ['Blusa Floral', 'Pantalón Cargo', 'Vestido Midi', 'Collar Perlas', 'Bolso Tote', 'Zapatos Platform', 'Gorra Vintage', 'Falda Plisada', 'Aretes Dorados', 'Sudadera Oversize', 'Cinturón Cuero', 'Top Crop'];
  const prices = [35, 45, 55, 18, 32, 48, 22, 38, 12, 42, 28, 25];
  
  const sales: SaleItem[] = [];
  for (let d = 0; d < 30; d++) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0];
    
    skus.forEach((sku, i) => {
      ['SHEIN', 'TIKTOK'].forEach(mp => {
        if (Math.random() > 0.3) {
          const qty = Math.floor(Math.random() * 8) + 1;
          const price = prices[i] + (mp === 'TIKTOK' ? 5 : 0);
          sales.push({
            SKU: sku,
            Producto: names[i],
            Cantidad: qty,
            PrecioVenta: price,
            Total: qty * price,
            Fecha: dateStr,
            Marketplace: mp,
          });
        }
      });
    });
  }
  return sales;
}
