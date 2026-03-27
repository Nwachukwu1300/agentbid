import { LucideIcon } from 'lucide-react';
import { cn, formatPercentage } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
  icon?: LucideIcon;
  iconColor?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  change,
  icon: Icon,
  iconColor = 'text-accent-purple',
  className,
}: StatCardProps) {
  return (
    <div className={cn('card flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className={cn('rounded-lg bg-background-tertiary p-2', iconColor)}>
              <Icon className="h-4 w-4" />
            </div>
          )}
          <span className="text-sm text-text-secondary">{label}</span>
        </div>
        {change !== undefined && (
          <span
            className={cn(
              'text-xs font-medium',
              change >= 0 ? 'text-accent-green' : 'text-accent-red'
            )}
          >
            {formatPercentage(change)}
          </span>
        )}
      </div>
      <p className="text-2xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}
