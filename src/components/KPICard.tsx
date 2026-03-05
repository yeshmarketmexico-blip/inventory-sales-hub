import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: number;
  status?: 'success' | 'warning' | 'destructive' | 'default';
}

const statusStyles = {
  success: 'border-success/30 bg-success/5',
  warning: 'border-warning/30 bg-warning/5',
  destructive: 'border-destructive/30 bg-destructive/5',
  default: 'border-border bg-card',
};

const statusIconColors = {
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
  default: 'text-primary',
};

export function KPICard({ title, value, subtitle, icon, trend, status = 'default' }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "rounded-xl border p-4 md:p-5 transition-all duration-300 hover:shadow-lg",
        "shadow-[var(--shadow-card)]",
        statusStyles[status]
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl md:text-3xl font-bold font-mono tracking-tight text-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {icon && (
          <div className={cn("p-2 rounded-lg bg-secondary", statusIconColors[status])}>
            {icon}
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1">
          {trend >= 0 ? (
            <TrendingUp className="w-3 h-3 text-success" />
          ) : (
            <TrendingDown className="w-3 h-3 text-destructive" />
          )}
          <span className={cn(
            "text-xs font-semibold font-mono",
            trend >= 0 ? "text-success" : "text-destructive"
          )}>
            {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
        </div>
      )}
    </motion.div>
  );
}
