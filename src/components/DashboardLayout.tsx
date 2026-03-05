import { ReactNode } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, TrendingUp, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData, Marketplace } from '@/hooks/useSheetData';
import { Button } from '@/components/ui/button';
import { DatePickerRange } from '@/components/DatePickerRange';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/inventario', label: 'Inventario', icon: Package },
  { path: '/compras', label: 'Compras', icon: ShoppingCart },
  { path: '/ventas', label: 'Ventas', icon: TrendingUp },
];

const marketplaces: { value: Marketplace; label: string }[] = [
  { value: 'SHEIN', label: 'SHEIN' },
  { value: 'TIKTOK', label: 'TIKTOK' },
  { value: 'COMBINADO', label: 'COMBINADO' },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { marketplace, setMarketplace, dateRange, setDateRange, loading, refreshData } = useData();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold text-gradient tracking-tight">
            StockPulse
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Gestión Unificada</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-primary/10 text-primary glow-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            {loading ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-3 h-3 animate-spin" /> Cargando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-success" /> Datos sincronizados
              </span>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm px-4 md:px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Mobile nav */}
            <div className="flex md:hidden gap-1">
              {navItems.map(item => {
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      active ? "bg-primary/10 text-primary" : "text-muted-foreground"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                  </Link>
                );
              })}
            </div>

            {/* Marketplace selector */}
            <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
              {marketplaces.map(mp => (
                <button
                  key={mp.value}
                  onClick={() => setMarketplace(mp.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200",
                    marketplace === mp.value
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-secondary-foreground hover:text-foreground"
                  )}
                >
                  {mp.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <DatePickerRange dateRange={dateRange} onDateRangeChange={setDateRange} />
              <Button
                variant="ghost"
                size="icon"
                onClick={refreshData}
                className="text-muted-foreground hover:text-primary"
              >
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname + marketplace}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
