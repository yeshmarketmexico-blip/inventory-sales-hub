import { ReactNode } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, TrendingUp, RefreshCw, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData, Marketplace } from '@/hooks/useSheetData';
import { DatePickerRange } from '@/components/DatePickerRange';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/',           label: 'Dashboard',  icon: LayoutDashboard, num: '01' },
  { path: '/inventario', label: 'Inventario', icon: Package,          num: '02' },
  { path: '/compras',    label: 'Compras',    icon: ShoppingCart,     num: '03' },
  { path: '/ventas',     label: 'Ventas',     icon: TrendingUp,       num: '04' },
];

const marketplaces: { value: Marketplace; label: string; color: string }[] = [
  { value: 'SHEIN',     label: 'SHEIN',     color: 'hsl(172 100% 48%)' },
  { value: 'TIKTOK',    label: 'TIKTOK',    color: 'hsl(265 65% 65%)' },
  { value: 'COMBINADO', label: 'COMBINADO', color: 'hsl(38 92% 55%)' },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { marketplace, setMarketplace, dateRange, setDateRange, loading, refreshData, usingDemo } = useData();

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="hidden md:flex w-56 flex-col border-r border-border bg-sidebar">
        {/* Logo */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <h1 className="font-mono text-sm font-bold tracking-widest text-primary uppercase">
              Yesh<span className="text-foreground/40">·</span>Hub
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-mono">v2.0 · {marketplace}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group",
                  active
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border border-transparent"
                )}
              >
                <span className="font-mono text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
                  {item.num}
                </span>
                <item.icon className="w-3.5 h-3.5" />
                <span className="font-medium text-xs tracking-wide">{item.label}</span>
                {active && (
                  <motion.div
                    layoutId="activeNav"
                    className="ml-auto w-1 h-4 rounded-full bg-primary"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Status */}
        <div className="p-4 border-t border-border space-y-2">
          {usingDemo && (
            <div className="font-mono text-[9px] text-warning/70 bg-warning/5 border border-warning/20 rounded px-2 py-1.5 tracking-wider">
              ⚠ MODO DEMO
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className={cn(
              "w-1.5 h-1.5 rounded-full animate-pulse-dot",
              loading ? "bg-warning" : "bg-success"
            )} />
            <span className="font-mono text-[9px] text-muted-foreground tracking-wider uppercase">
              {loading ? 'Sincronizando...' : 'Datos en vivo'}
            </span>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="border-b border-border bg-card/60 backdrop-blur-md px-4 md:px-5 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">

            {/* Mobile nav icons */}
            <div className="flex md:hidden gap-1">
              {navItems.map(item => {
                const active = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path}
                    className={cn("p-2 rounded-lg transition-colors",
                      active ? "bg-primary/10 text-primary" : "text-muted-foreground"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                  </Link>
                );
              })}
            </div>

            {/* Marketplace selector */}
            <div className="flex items-center gap-1 bg-secondary/80 rounded-lg p-1 border border-border">
              {marketplaces.map(mp => (
                <button
                  key={mp.value}
                  onClick={() => setMarketplace(mp.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-md font-mono text-[10px] font-bold tracking-widest transition-all duration-200 uppercase",
                    marketplace === mp.value
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  style={marketplace === mp.value ? { background: mp.color, color: '#05080f' } : {}}
                >
                  {mp.label}
                </button>
              ))}
            </div>

            {/* Right: date + refresh */}
            <div className="flex items-center gap-2">
              <DatePickerRange dateRange={dateRange} onDateRangeChange={setDateRange} />
              <button
                onClick={refreshData}
                className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 md:p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname + marketplace}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
