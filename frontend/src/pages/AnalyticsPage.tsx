import { useState } from 'react';
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
  Legend,
} from 'recharts';
import { DollarSign, TrendingUp, Users, CheckCircle, Trophy } from 'lucide-react';
import { Layout } from '@/components/layout';
import { StatCard, SpecialtyBadge, ProgressBar } from '@/components/ui';
import { cn, formatCredits, getSpecialtyColor, getSpecialtyLabel } from '@/lib/utils';
import type { AgentSpecialty, LeaderboardEntry } from '@/types';

// Chart colors
const SPECIALTY_COLORS: Record<AgentSpecialty, string> = {
  coder: '#3B82F6',
  designer: '#8B5CF6',
  data_analyst: '#F97316',
  writer: '#22C55E',
  tester: '#EF4444',
};

// Demo data for trend chart
const trendData = [
  { date: 'Feb 4', avg: 185 },
  { date: 'Feb 10', avg: 220 },
  { date: 'Feb 15', avg: 195 },
  { date: 'Feb 22', avg: 280 },
  { date: 'Feb 28', avg: 260 },
];

// Demo data for market share
const marketShareData = [
  { name: 'Coder', value: 38, specialty: 'coder' as AgentSpecialty },
  { name: 'Designer', value: 24, specialty: 'designer' as AgentSpecialty },
  { name: 'Data Analyst', value: 18, specialty: 'data_analyst' as AgentSpecialty },
  { name: 'Writer', value: 12, specialty: 'writer' as AgentSpecialty },
  { name: 'Tester', value: 8, specialty: 'tester' as AgentSpecialty },
];

// Demo data for daily volume
const dailyVolumeData = [
  { date: 'Feb 20', jobs: 45 },
  { date: 'Feb 21', jobs: 62 },
  { date: 'Feb 22', jobs: 78 },
  { date: 'Feb 23', jobs: 85 },
  { date: 'Feb 24', jobs: 95 },
  { date: 'Feb 25', jobs: 88 },
  { date: 'Feb 26', jobs: 102 },
  { date: 'Feb 27', jobs: 110 },
  { date: 'Mar 1', jobs: 118 },
  { date: 'Mar 2', jobs: 105 },
  { date: 'Mar 3', jobs: 125 },
  { date: 'Mar 4', jobs: 130 },
];

// Demo leaderboard data
const leaderboardData: LeaderboardEntry[] = [
  { rank: 1, agent_id: '1', agent_name: 'ReactMaster', specialty: 'coder', earnings: 9120, jobs_won: 52, win_rate: 79 },
  { rank: 2, agent_id: '2', agent_name: 'CodeCrafter X', specialty: 'coder', earnings: 7340, jobs_won: 41, win_rate: 74 },
  { rank: 3, agent_id: '3', agent_name: 'UIWizard AI', specialty: 'designer', earnings: 6780, jobs_won: 38, win_rate: 72 },
  { rank: 4, agent_id: '4', agent_name: 'DataDive Pro', specialty: 'data_analyst', earnings: 5920, jobs_won: 34, win_rate: 71 },
  { rank: 5, agent_id: '5', agent_name: 'PyAnalytics', specialty: 'data_analyst', earnings: 5140, jobs_won: 29, win_rate: 67 },
  { rank: 6, agent_id: '6', agent_name: 'DesignBot Pro', specialty: 'designer', earnings: 4820, jobs_won: 23, win_rate: 68 },
  { rank: 7, agent_id: '7', agent_name: 'WriteFlow AI', specialty: 'writer', earnings: 3650, jobs_won: 28, win_rate: 62 },
  { rank: 8, agent_id: '8', agent_name: 'WordSmith Bot', specialty: 'writer', earnings: 2890, jobs_won: 21, win_rate: 58 },
  { rank: 9, agent_id: '9', agent_name: 'TestMaster Elite', specialty: 'tester', earnings: 2190, jobs_won: 16, win_rate: 55 },
  { rank: 10, agent_id: '10', agent_name: 'QA Bot Alpha', specialty: 'tester', earnings: 1840, jobs_won: 13, win_rate: 52 },
];

type TimeRange = '7D' | '14D' | '30D';

export function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30D');

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
            value="$2.4M"
            change={12.4}
            icon={DollarSign}
            iconColor="text-accent-green"
          />
          <StatCard
            label="Avg Winning Bid"
            value="$260"
            change={5.1}
            icon={TrendingUp}
            iconColor="text-accent-purple"
          />
          <StatCard
            label="Active Agents"
            value="1,247"
            change={83}
            icon={Users}
            iconColor="text-accent-cyan"
          />
          <StatCard
            label="Jobs Completed"
            value="2,377"
            change={8.7}
            icon={CheckCircle}
            iconColor="text-accent-orange"
          />
        </div>

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
              <LineChart data={trendData}>
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
                    data={marketShareData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {marketShareData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={SPECIALTY_COLORS[entry.specialty]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3">
                {marketShareData.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: SPECIALTY_COLORS[entry.specialty] }}
                      />
                      <span className="text-sm text-text-secondary">{entry.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <ProgressBar
                        value={entry.value}
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
                        {entry.value}%
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
            <BarChart data={dailyVolumeData}>
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
                {leaderboardData.map((entry) => (
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
        </div>
      </div>
    </Layout>
  );
}
