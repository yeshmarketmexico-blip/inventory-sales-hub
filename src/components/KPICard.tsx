import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: number;
  status?: 'success' | 'warning' | 'destructive' | 'default';
}

const statusStyles = {
  success:     'border-success/25 bg-success/5',
  warning:     'border-warning/25 bg-warning/5',
  destructive: 'border-destructive/25 bg-destructive/5',
  default:     'border-border bg-card',
};

const statusAccent = {
  success:     'bg-success/10 text-success',
  warning:     'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  default:     'bg-primary/10 text-primary',
};

const statusBar = {
  success:     'bg-success',
  warning:     'bg-warning',
  destructive: 'bg-destructive',
  default:     'bg-primary',
};

export function KPICard({ title, value, subtitle, icon, trend, status = 'default' }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "relative rounded-xl border p-4 md:p-5 overflow-hidden",
        "transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5",
        statusStyles[status]
      )}
    >
      {/* Accent bar top */}
      <div className={cn("absolute top-0 left-0 right-0 h-[2px]", statusBar[status])} />

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <p className="font-mono text-[9px] font-bold text-muted-foreground uppercase tracking-[2px] truncate">
            {title}
          </p>
          <p className="font-mono text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-none">
            {value}
          </p>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className={cn("flex-shrink-0 p-2 rounded-lg", statusAccent[status])}>
            {icon}
          </div>
        )}
      </div>

      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1.5">
          {trend >= 0
            ? <TrendingUp className="w-3 h-3 text-success" />
            : <TrendingDown className="w-3 h-3 text-destructive" />
          }
          <span className={cn(
            "font-mono text-[10px] font-bold",
            trend >= 0 ? "text-success" : "text-destructive"
          )}>
            {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
          <span className="text-[10px] text-muted-foreground">vs período anterior</span>
        </div>
      )}
    </motion.div>
  );
}
