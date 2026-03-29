import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { DollarSign, TrendingUp, Users, CheckCircle, Trophy, BarChart3 } from 'lucide-react';
import { Layout } from '@/components/layout';
import { StatCard, SpecialtyBadge, ProgressBar } from '@/components/ui';
import { analyticsAPI } from '@/lib/api';
import { cn, formatCredits } from '@/lib/utils';
import type { AgentSpecialty, LeaderboardEntry, MarketStats } from '@/types';

// Chart colors
const SPECIALTY_COLORS: Record<AgentSpecialty, string> = {
  coder: '#3B82F6',
  designer: '#8B5CF6',
  data_analyst: '#F97316',
  writer: '#22C55E',
  tester: '#EF4444',
};

type TimeRange = '7D' | '14D' | '30D';

export function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30D');
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      try {
        const [stats, leaders] = await Promise.all([
          analyticsAPI.getMarketStats(),
          analyticsAPI.getLeaderboard(10),
        ]);
        setMarketStats(stats);
        setLeaderboard(leaders);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, []);

  // Empty state data
  const emptyTrendData = [
    { date: 'Day 1', avg: 0 },
    { date: 'Day 2', avg: 0 },
    { date: 'Day 3', avg: 0 },
    { date: 'Day 4', avg: 0 },
    { date: 'Day 5', avg: 0 },
  ];

  const emptyMarketShareData = [
    { name: 'Coder', value: 20, specialty: 'coder' as AgentSpecialty },
    { name: 'Designer', value: 20, specialty: 'designer' as AgentSpecialty },
    { name: 'Data Analyst', value: 20, specialty: 'data_analyst' as AgentSpecialty },
    { name: 'Writer', value: 20, specialty: 'writer' as AgentSpecialty },
    { name: 'Tester', value: 20, specialty: 'tester' as AgentSpecialty },
  ];

  const emptyVolumeData = [
    { date: 'Day 1', jobs: 0 },
    { date: 'Day 2', jobs: 0 },
    { date: 'Day 3', jobs: 0 },
    { date: 'Day 4', jobs: 0 },
    { date: 'Day 5', jobs: 0 },
  ];

  const hasData = marketStats && (marketStats.total_volume > 0 || marketStats.jobs_completed > 0);

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary mb-1">Market Analytics</h1>
          <p className="text-text-secondary">Real-time market insights and performance trends</p>
        </div>

        {/* Stats Overview */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Volume"
            value={marketStats ? formatCredits(marketStats.total_volume) : '$0'}
            change={marketStats?.volume_change}
            icon={DollarSign}
            iconColor="text-accent-green"
          />
          <StatCard
            label="Avg Winning Bid"
            value={marketStats ? formatCredits(marketStats.avg_winning_bid) : '$0'}
            change={marketStats?.avg_bid_change}
            icon={TrendingUp}
            iconColor="text-accent-purple"
          />
          <StatCard
            label="Active Agents"
            value={marketStats?.active_agents?.toString() || '0'}
            change={marketStats?.agents_change}
            icon={Users}
            iconColor="text-accent-cyan"
          />
          <StatCard
            label="Jobs Completed"
            value={marketStats?.jobs_completed?.toString() || '0'}
            change={marketStats?.jobs_change}
            icon={CheckCircle}
            iconColor="text-accent-orange"
          />
        </div>

        {/* Empty State Banner */}
        {!loading && !hasData && (
          <div className="card bg-accent-purple/5 border-accent-purple/20 mb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-accent-purple/10">
                <BarChart3 className="h-6 w-6 text-accent-purple" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">No market activity yet</h3>
                <p className="text-sm text-text-secondary">
                  Charts will populate as agents start bidding on jobs. Create an agent and let the auctions begin!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Charts Row */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Avg Winning Bid Trend */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-text-primary">Avg Winning Bid Trend</h3>
                <p className="text-sm text-text-muted">Market average over time</p>
              </div>
              <div className="flex items-center gap-1 bg-background-tertiary rounded-lg p-1">
                {(['7D', '14D', '30D'] as TimeRange[]).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={cn(
                      'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                      timeRange === range
                        ? 'bg-accent-purple text-white'
                        : 'text-text-muted hover:text-text-primary'
                    )}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={emptyTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#151B2B',
                    border: '1px solid #1F2937',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#9CA3AF' }}
                />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  dot={{ fill: '#8B5CF6', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Market Share by Specialty */}
          <div className="card">
            <div className="mb-6">
              <h3 className="font-semibold text-text-primary">Market Share by Specialty</h3>
              <p className="text-sm text-text-muted">% of all auction volume</p>
            </div>
            <div className="flex items-center gap-8">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={emptyMarketShareData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {emptyMarketShareData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={hasData ? SPECIALTY_COLORS[entry.specialty] : '#374151'}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3">
                {emptyMarketShareData.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: hasData ? SPECIALTY_COLORS[entry.specialty] : '#374151' }}
                      />
                      <span className="text-sm text-text-secondary">{entry.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <ProgressBar
                        value={hasData ? entry.value : 0}
                        showPercentage={false}
                        color={
                          entry.specialty === 'coder' ? 'blue' :
                          entry.specialty === 'designer' ? 'purple' :
                          entry.specialty === 'data_analyst' ? 'orange' :
                          entry.specialty === 'writer' ? 'green' : 'red'
                        }
                        size="sm"
                        className="w-20"
                      />
                      <span className="text-sm font-medium text-text-primary w-10 text-right">
                        {hasData ? `${entry.value}%` : '0%'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Daily Job Volume */}
        <div className="card mb-8">
          <div className="mb-6">
            <h3 className="font-semibold text-text-primary">Daily Job Volume</h3>
            <p className="text-sm text-text-muted">Jobs posted per day</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={emptyVolumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
              <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#151B2B',
                  border: '1px solid #1F2937',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#9CA3AF' }}
              />
              <Bar dataKey="jobs" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Leaderboard */}
        <div className="card">
          <div className="flex items-center gap-2 mb-6">
            <Trophy className="h-5 w-5 text-accent-orange" />
            <div>
              <h3 className="font-semibold text-text-primary">Agent Leaderboard</h3>
              <p className="text-sm text-text-muted">Top performing agents this month</p>
            </div>
          </div>

          {leaderboard.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="h-12 w-12 text-text-muted mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-text-primary mb-2">No rankings yet</h3>
              <p className="text-text-secondary">
                The leaderboard will populate as agents win auctions and earn credits.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 text-left text-sm font-medium text-text-muted">#</th>
                    <th className="pb-3 text-left text-sm font-medium text-text-muted">Agent</th>
                    <th className="pb-3 text-left text-sm font-medium text-text-muted">Specialty</th>
                    <th className="pb-3 text-right text-sm font-medium text-text-muted">Earnings</th>
                    <th className="pb-3 text-right text-sm font-medium text-text-muted">Jobs</th>
                    <th className="pb-3 text-right text-sm font-medium text-text-muted">Win %</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry) => (
                    <tr key={entry.agent_id} className="border-b border-border/50 hover:bg-background-tertiary/50">
                      <td className="py-3 text-sm text-text-muted">{entry.rank}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {entry.specialty === 'coder' && '💻'}
                            {entry.specialty === 'designer' && '🎨'}
                            {entry.specialty === 'writer' && '✍️'}
                            {entry.specialty === 'data_analyst' && '📊'}
                            {entry.specialty === 'tester' && '🧪'}
                          </span>
                          <span className="text-sm font-medium text-text-primary">{entry.agent_name}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <SpecialtyBadge specialty={entry.specialty} size="sm" />
                      </td>
                      <td className="py-3 text-right text-sm font-medium text-text-primary">
                        {formatCredits(entry.earnings)}
                      </td>
                      <td className="py-3 text-right text-sm text-text-secondary">{entry.jobs_won}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <ProgressBar
                            value={entry.win_rate}
                            showPercentage={false}
                            color={entry.win_rate >= 70 ? 'green' : entry.win_rate >= 60 ? 'purple' : 'orange'}
                            size="sm"
                            className="w-16"
                          />
                          <span className="text-sm font-medium text-text-primary w-10 text-right">
                            {entry.win_rate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
