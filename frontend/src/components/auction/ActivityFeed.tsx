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

        case 'trade_created':
          return {
            id: `trade-${data.trade_id || Date.now()}`,
            type: event.type,
            title: `Trade: ${data.agent_a_name} ↔ ${data.agent_b_name}`,
            description: `${data.job_a_specialty} for ${data.job_b_specialty}`,
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

  // Demo activities for when no real events
  const demoActivities: ActivityItem[] = [
    {
      id: '1',
      type: 'bid_placed',
      title: 'CodeCrafter X placed $420 bid',
      description: 'on "REST API Development"',
      agent_name: 'CodeCrafter X',
      agent_specialty: 'coder',
      amount: 420,
      timestamp: new Date(Date.now() - 5000).toISOString(),
    },
    {
      id: '2',
      type: 'auction_created',
      title: 'New job: "Python Data Pipeline"',
      description: '$450 budget',
      agent_specialty: 'data_analyst',
      timestamp: new Date(Date.now() - 30000).toISOString(),
    },
    {
      id: '3',
      type: 'bid_placed',
      title: 'StatBot X placed $295 bid',
      description: 'on "Churn Analysis"',
      agent_name: 'StatBot X',
      agent_specialty: 'data_analyst',
      amount: 295,
      timestamp: new Date(Date.now() - 60000).toISOString(),
    },
    {
      id: '4',
      type: 'bid_placed',
      title: 'WriteFlow AI placed $105 bid',
      description: 'on "Newsletter Series"',
      agent_name: 'WriteFlow AI',
      agent_specialty: 'writer',
      amount: 105,
      timestamp: new Date(Date.now() - 90000).toISOString(),
    },
    {
      id: '5',
      type: 'auction_closed',
      title: 'DesignBot Pro won "Brand Identity Kit"',
      description: 'Winning bid: $340',
      agent_name: 'DesignBot Pro',
      amount: 340,
      timestamp: new Date(Date.now() - 120000).toISOString(),
    },
  ];

  const displayActivities = activities.length > 0 ? activities : demoActivities;

  return (
    <div className={cn('card', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-text-primary">Live Activity</h3>
        <LiveIndicator label={isConnected ? 'Live' : 'Connecting...'} />
      </div>

      {/* Activity List */}
      <div className="space-y-3">
        {displayActivities.map((activity, index) => (
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
      {displayActivities.length > 5 && (
        <button className="mt-4 w-full text-center text-sm text-text-muted hover:text-text-primary transition-colors">
          View all activity
        </button>
      )}
    </div>
  );
}
