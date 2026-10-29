import { useEffect, useState } from 'react';
import { cn, formatTimeAgo, formatCredits, getSpecialtyColor } from '@/lib/utils';
import { LiveIndicator, SpecialtyBadge } from '@/components/ui';
import { useSSE } from '@/lib/sse';
import type { ActivityItem, AgentSpecialty } from '@/types';

interface ActivityFeedProps {
  maxItems?: number;
  className?: string;
}

export function ActivityFeed({ maxItems = 10, className }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const { events, isConnected } = useSSE('all');

  // Convert SSE events to activity items
  useEffect(() => {
    if (events.length === 0) return;

    const newActivities: ActivityItem[] = events.map((event) => {
      const data = event.data as Record<string, unknown>;

      switch (event.type) {
        case 'bid_placed':
          return {
            id: `bid-${data.bid_id || Date.now()}`,
            type: event.type,
            title: `${data.agent_name} placed ${formatCredits(data.amount as number)} bid`,
            description: data.reasoning as string || `on "${(data as Record<string, unknown>).job_title || 'auction'}"`,
            agent_name: data.agent_name as string,
            agent_specialty: data.agent_specialty as AgentSpecialty,
            amount: data.amount as number,
            timestamp: event.timestamp,
          };

        case 'auction_created':
          return {
            id: `auction-${data.auction_id || Date.now()}`,
            type: event.type,
            title: `New job: "${data.job_title}"`,
            description: `${formatCredits(data.job_base_price as number)} budget`,
            agent_specialty: data.job_specialty as AgentSpecialty,
            timestamp: event.timestamp,
          };

        case 'auction_closed':
          return {
            id: `closed-${data.auction_id || Date.now()}`,
            type: event.type,
            title: data.winner_agent_name
              ? `${data.winner_agent_name} won "${data.job_title}"`
              : `Auction closed: "${data.job_title}"`,
            description: data.winning_bid
              ? `Winning bid: ${formatCredits(data.winning_bid as number)}`
              : 'No winner',
            agent_name: data.winner_agent_name as string,
            amount: data.winning_bid as number,
            timestamp: event.timestamp,
          };

        case 'season_ended':
          return {
            id: `season-${data.season_number}`,
            type: event.type,
            title: data.winner_agent_name
              ? `Season ${data.season_number} won by ${data.winner_agent_name}`
              : `Season ${data.season_number} ended`,
            description: data.winner_credits != null
              ? `Finished with ${formatCredits(data.winner_credits as number)}. Credits reset for the new season.`
              : 'Credits reset for the new season.',
            agent_name: data.winner_agent_name as string,
            timestamp: event.timestamp,
          };

        case 'agent_decision':
          return {
            id: `decision-${Date.now()}`,
            type: event.type,
            title: `${data.agent_name} ${data.decision_type}`,
            description: data.reasoning as string,
            agent_name: data.agent_name as string,
            agent_specialty: data.agent_specialty as AgentSpecialty,
            timestamp: event.timestamp,
          };

        default:
          return {
            id: `event-${Date.now()}`,
            type: event.type,
            title: 'Activity',
            description: JSON.stringify(data),
            timestamp: event.timestamp,
          };
      }
    });

    setActivities(newActivities.slice(0, maxItems));
  }, [events, maxItems]);

  return (
    <div className={cn('card', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-text-primary">Live Activity</h3>
        <LiveIndicator label={isConnected ? 'Live' : 'Connecting...'} />
      </div>

      {/* Activity List */}
      <div className="space-y-3">
        {activities.length === 0 && (
          <p className="text-sm text-text-muted text-center py-6">
            {isConnected ? 'Waiting for the next bid...' : 'Connecting to the live feed...'}
          </p>
        )}
        {activities.map((activity, index) => (
          <div
            key={activity.id}
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg bg-background-tertiary/50 animate-fade-in',
              index === 0 && 'bg-background-tertiary'
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Specialty indicator */}
            <div
              className={cn(
                'mt-0.5 h-2 w-2 rounded-full flex-shrink-0',
                activity.agent_specialty
                  ? getSpecialtyColor(activity.agent_specialty)
                  : 'bg-text-muted'
              )}
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-text-primary font-medium truncate">
                  {activity.title}
                </p>
                <span className="text-xs text-text-muted whitespace-nowrap">
                  {formatTimeAgo(activity.timestamp)}
                </span>
              </div>
              <p className="text-xs text-text-secondary truncate">
                {activity.description}
              </p>
              {activity.agent_specialty && (
                <SpecialtyBadge specialty={activity.agent_specialty} size="sm" className="mt-1" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* View All Link */}
      {activities.length > 5 && (
        <button className="mt-4 w-full text-center text-sm text-text-muted hover:text-text-primary transition-colors">
          View all activity
        </button>
      )}
    </div>
  );
}
