

## Analysis

From the network requests, both APIs require an `?action=` query parameter:

- **Inventory endpoint** (`AKfycbweOy...`) returns `{"error":"acción no válida"}` when called without params
- **Sales endpoint** (`AKfycby4hH...`) returns endpoint metadata showing it supports `?action=inventario`, `?action=ordenes`, `?action=forecast`

The APIs are Google Apps Script — CORS is handled automatically by Google (they redirect to a googleusercontent.com domain that serves with permissive CORS). The 200 status confirms no CORS issue exists.

## Plan

### 1. Update `useSheetData.tsx` fetch logic

- Append `?action=inventario` to the Inventory URL
- Append `?action=ordenes` to the Sales URL  
- Map the real API field names to internal types:
  - Inventory: `SKU`, `Nombre`→`Producto`, `Stock`, `PrecioMXN`→`PrecioVenta`, `CostoUnitario`→`PrecioCompra`, `Canal`→`Marketplace`
  - Sales/Orders: `SKU`, `Fecha`, `UnidadesVendidas`→`Cantidad`, `Canal`→`Marketplace`
- Calculate derived fields (e.g., `Total = Cantidad * PrecioVenta` by looking up inventory)
- Keep demo data as fallback only when fetch fails
- Remove the assumption that raw JSON is directly usable — add a normalization/mapping layer

### 2. Fetch both endpoints from the Sales API too

Since the Sales API also exposes `?action=inventario`, we may need to fetch inventory from **both** APIs (one per marketplace/store) and combine. But first, we should test what each endpoint returns with the correct action params. The plan will add the action params and normalize response data, with console logging to inspect the actual structure on first load.

### Technical Details

**File: `src/hooks/useSheetData.tsx`**
- Change `INVENTORY_URL` to append `?action=inventario`
- Change `SALES_URL` to append `?action=ordenes`
- Add a `normalizeInventory(rawData)` function that maps API field names to `InventoryItem`
- Add a `normalizeSales(rawData)` function that maps API field names to `SaleItem`
- Add `console.log` for raw responses initially to verify the exact field names from the real API
- Keep `generateDemoInventory`/`generateDemoSales` as catch-block fallbacks

