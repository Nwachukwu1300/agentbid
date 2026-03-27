import { Link } from 'react-router-dom';
import { DollarSign, Trophy, TrendingUp, Zap, Pause, Play, Eye, Settings, Trash2 } from 'lucide-react';
import { Agent, AgentStats } from '@/types';
import { cn, formatCredits, getSpecialtyBorderColor } from '@/lib/utils';
import { SpecialtyBadge, ProgressBar } from '@/components/ui';

interface AgentCardProps {
  agent: Agent;
  stats?: AgentStats;
  onPause?: () => void;
  onResume?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function AgentCard({
  agent,
  stats = { total_earnings: 0, jobs_won: 0, win_rate: 0, active_bids: 0 },
  onPause,
  onResume,
  onDelete,
  className,
}: AgentCardProps) {
  return (
    <div
      className={cn(
        'card relative overflow-hidden border-l-4',
        getSpecialtyBorderColor(agent.specialty),
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background-tertiary text-lg">
            {agent.specialty === 'coder' && '💻'}
            {agent.specialty === 'designer' && '🎨'}
            {agent.specialty === 'writer' && '✍️'}
            {agent.specialty === 'data_analyst' && '📊'}
            {agent.specialty === 'tester' && '🧪'}
          </div>
          <div>
            <h3 className="font-semibold text-text-primary">{agent.name}</h3>
            <SpecialtyBadge specialty={agent.specialty} size="sm" />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              agent.is_active ? 'text-accent-green' : 'text-text-muted'
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                agent.is_active ? 'bg-accent-green' : 'bg-text-muted'
              )}
            />
            {agent.is_active ? 'Active' : 'Paused'}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-text-muted">
            <DollarSign className="h-3.5 w-3.5" />
            <span className="text-xs">Earnings</span>
          </div>
          <p className="text-lg font-semibold text-text-primary">
            {formatCredits(stats.total_earnings)}
          </p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-text-muted">
            <Trophy className="h-3.5 w-3.5" />
            <span className="text-xs">Jobs Won</span>
          </div>
          <p className="text-lg font-semibold text-text-primary">{stats.jobs_won}</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-text-muted">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-xs">Win Rate</span>
          </div>
          <p className="text-lg font-semibold text-text-primary">{stats.win_rate}%</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-text-muted">
            <Zap className="h-3.5 w-3.5" />
            <span className="text-xs">Active Bids</span>
          </div>
          <p className="text-lg font-semibold text-text-primary">{stats.active_bids}</p>
        </div>
      </div>

      {/* Win Rate Progress */}
      <ProgressBar
        value={stats.win_rate}
        label="Win rate"
        showPercentage
        color={stats.win_rate >= 70 ? 'green' : stats.win_rate >= 50 ? 'purple' : 'orange'}
        size="sm"
        className="mb-4"
      />

      {/* Credits */}
      <div className="flex items-center justify-between text-sm mb-4">
        <span className="text-text-muted">
          <span className="text-accent-cyan">◆</span> {formatCredits(agent.credits)} credits remaining
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-4 border-t border-border">
        <Link
          to={`/agents/${agent.id}`}
          className="flex-1 btn-secondary text-sm py-2"
        >
          <Eye className="mr-1.5 h-4 w-4" />
          View Profile
        </Link>
        <button
          onClick={agent.is_active ? onPause : onResume}
          className="btn-ghost p-2"
          title={agent.is_active ? 'Pause agent' : 'Resume agent'}
        >
          {agent.is_active ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </button>
        <button className="btn-ghost p-2" title="Settings">
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
