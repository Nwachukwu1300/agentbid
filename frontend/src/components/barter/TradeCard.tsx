import { ArrowLeftRight, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { TradeWithDetails } from '@/types';
import { cn, formatTimeAgo, getSpecialtyIcon } from '@/lib/utils';
import { SpecialtyBadge } from '@/components/ui';

interface TradeCardProps {
  trade: TradeWithDetails;
  className?: string;
}

export function TradeCard({ trade, className }: TradeCardProps) {
  const statusConfig = {
    pending: {
      label: 'Pending',
      icon: Clock,
      color: 'text-accent-orange',
      bg: 'bg-accent-orange/10',
    },
    in_progress: {
      label: 'In Progress',
      icon: Loader2,
      color: 'text-accent-blue',
      bg: 'bg-accent-blue/10',
    },
    completed: {
      label: 'Completed',
      icon: CheckCircle,
      color: 'text-accent-green',
      bg: 'bg-accent-green/10',
    },
    failed: {
      label: 'Failed',
      icon: Clock,
      color: 'text-accent-red',
      bg: 'bg-accent-red/10',
    },
  };

  const status = statusConfig[trade.status];
  const StatusIcon = status.icon;

  return (
    <div className={cn('card', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-accent-purple" />
          <span className="font-medium text-text-primary">Barter Trade</span>
        </div>
        <div
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
            status.bg,
            status.color
          )}
        >
          <StatusIcon className={cn('h-3.5 w-3.5', trade.status === 'in_progress' && 'animate-spin')} />
          {status.label}
        </div>
      </div>

      {/* Trade Participants */}
      <div className="flex items-stretch gap-3 p-4 rounded-lg bg-background-tertiary mb-4">
        {/* Agent A */}
        <div className="flex-1 text-center">
          <p className="text-sm font-medium text-text-primary mb-2">{trade.agent_a_name}</p>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-xl">{getSpecialtyIcon(trade.job_a_specialty)}</span>
            <SpecialtyBadge specialty={trade.job_a_specialty} size="sm" />
          </div>
          <p className="text-xs text-text-muted">Providing</p>
          {trade.job_a_completed && (
            <CheckCircle className="h-4 w-4 text-accent-green mx-auto mt-2" />
          )}
        </div>

        {/* Exchange indicator */}
        <div className="flex items-center">
          <ArrowLeftRight className="h-5 w-5 text-text-muted" />
        </div>

        {/* Agent B */}
        <div className="flex-1 text-center">
          <p className="text-sm font-medium text-text-primary mb-2">{trade.agent_b_name}</p>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-xl">{getSpecialtyIcon(trade.job_b_specialty)}</span>
            <SpecialtyBadge specialty={trade.job_b_specialty} size="sm" />
          </div>
          <p className="text-xs text-text-muted">Providing</p>
          {trade.job_b_completed && (
            <CheckCircle className="h-4 w-4 text-accent-green mx-auto mt-2" />
          )}
        </div>
      </div>

      {/* Job Descriptions */}
      {(trade.job_a_description || trade.job_b_description) && (
        <div className="space-y-2 mb-4">
          {trade.job_a_description && (
            <p className="text-xs text-text-secondary line-clamp-2">
              <span className="font-medium">{trade.agent_a_name}:</span> {trade.job_a_description}
            </p>
          )}
          {trade.job_b_description && (
            <p className="text-xs text-text-secondary line-clamp-2">
              <span className="font-medium">{trade.agent_b_name}:</span> {trade.job_b_description}
            </p>
          )}
        </div>
      )}

      {/* Timestamps */}
      <div className="flex items-center justify-between text-xs text-text-muted pt-3 border-t border-border">
        <span>Created {formatTimeAgo(trade.created_at)}</span>
        {trade.completed_at && <span>Completed {formatTimeAgo(trade.completed_at)}</span>}
      </div>
    </div>
  );
}
