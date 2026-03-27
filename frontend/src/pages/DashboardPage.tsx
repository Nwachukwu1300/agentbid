import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, DollarSign, Trophy, TrendingUp, Zap } from 'lucide-react';
import { Layout } from '@/components/layout';
import { AgentCard } from '@/components/agent';
import { StatCard } from '@/components/ui';
import { agentsAPI } from '@/lib/api';
import { formatCredits } from '@/lib/utils';
import type { Agent, AgentStats } from '@/types';

// Demo data for development
const demoAgents: (Agent & { stats: AgentStats })[] = [
  {
    id: '1',
    user_id: 'u1',
    name: 'DesignBot Pro',
    specialty: 'designer',
    auction_instructions: 'Bid aggressively on logo and branding jobs',
    barter_instructions: 'Trade design services for coding work',
    credits: 2400,
    current_jobs: 2,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    stats: { total_earnings: 4820, jobs_won: 23, win_rate: 68, active_bids: 3 },
  },
  {
    id: '2',
    user_id: 'u1',
    name: 'CodeCrafter X',
    specialty: 'coder',
    auction_instructions: 'Focus on high-value API development jobs',
    barter_instructions: 'Prefer trading for testing services',
    credits: 3800,
    current_jobs: 3,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    stats: { total_earnings: 7340, jobs_won: 41, win_rate: 74, active_bids: 5 },
  },
  {
    id: '3',
    user_id: 'u1',
    name: 'TestMaster Elite',
    specialty: 'tester',
    auction_instructions: 'Bid on comprehensive testing jobs',
    barter_instructions: 'Will trade QA for any specialty',
    credits: 1200,
    current_jobs: 1,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    stats: { total_earnings: 2190, jobs_won: 15, win_rate: 55, active_bids: 2 },
  },
  {
    id: '4',
    user_id: 'u1',
    name: 'WriteFlow AI',
    specialty: 'writer',
    auction_instructions: 'Target content marketing and blog posts',
    barter_instructions: 'Trade writing for design work',
    credits: 1900,
    current_jobs: 2,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    stats: { total_earnings: 3650, jobs_won: 28, win_rate: 62, active_bids: 1 },
  },
  {
    id: '5',
    user_id: 'u1',
    name: 'DataDive Pro',
    specialty: 'data_analyst',
    auction_instructions: 'Specialize in analytics and ML jobs',
    barter_instructions: 'Open to all trades',
    credits: 2800,
    current_jobs: 3,
    is_active: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    stats: { total_earnings: 5920, jobs_won: 34, win_rate: 71, active_bids: 4 },
  },
];

export function DashboardPage() {
  const [agents, setAgents] = useState<(Agent & { stats: AgentStats })[]>(demoAgents);
  const [loading, setLoading] = useState(false);

  // Calculate aggregate stats
  const totalEarnings = agents.reduce((sum, a) => sum + a.stats.total_earnings, 0);
  const totalJobsWon = agents.reduce((sum, a) => sum + a.stats.jobs_won, 0);
  const avgWinRate = agents.length > 0
    ? Math.round(agents.reduce((sum, a) => sum + a.stats.win_rate, 0) / agents.length)
    : 0;
  const totalActiveBids = agents.reduce((sum, a) => sum + a.stats.active_bids, 0);

  // Fetch agents from API
  useEffect(() => {
    async function fetchAgents() {
      setLoading(true);
      try {
        const data = await agentsAPI.list({ limit: 50 });
        if (data.length > 0) {
          // Add mock stats to real agents
          const withStats = data.map((agent) => ({
            ...agent,
            stats: {
              total_earnings: Math.floor(Math.random() * 10000),
              jobs_won: Math.floor(Math.random() * 50),
              win_rate: Math.floor(Math.random() * 40) + 50,
              active_bids: Math.floor(Math.random() * 10),
            },
          }));
          setAgents(withStats);
        }
      } catch (error) {
        console.error('Failed to fetch agents:', error);
        // Keep demo data on error
      } finally {
        setLoading(false);
      }
    }

    fetchAgents();
  }, []);

  const handlePauseAgent = (agentId: string) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === agentId ? { ...a, is_active: false } : a))
    );
  };

  const handleResumeAgent = (agentId: string) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === agentId ? { ...a, is_active: true } : a))
    );
  };

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-1">My Agents</h1>
            <p className="text-text-secondary">{agents.length} agents in your fleet</p>
          </div>
          <Link to="/create-agent" className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />
            Create Agent
          </Link>
        </div>

        {/* Stats Overview */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Earnings"
            value={formatCredits(totalEarnings)}
            icon={DollarSign}
            iconColor="text-accent-green"
          />
          <StatCard
            label="Jobs Won"
            value={totalJobsWon.toString()}
            icon={Trophy}
            iconColor="text-accent-orange"
          />
          <StatCard
            label="Avg Win Rate"
            value={`${avgWinRate}%`}
            icon={TrendingUp}
            iconColor="text-accent-purple"
          />
          <StatCard
            label="Active Bids"
            value={totalActiveBids.toString()}
            icon={Zap}
            iconColor="text-accent-cyan"
          />
        </div>

        {/* Agents Grid */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 bg-background-tertiary rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-background-tertiary rounded w-1/2 mb-2" />
                    <div className="h-3 bg-background-tertiary rounded w-1/4" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j}>
                      <div className="h-3 bg-background-tertiary rounded w-1/2 mb-2" />
                      <div className="h-5 bg-background-tertiary rounded w-3/4" />
                    </div>
                  ))}
                </div>
                <div className="h-2 bg-background-tertiary rounded w-full mb-4" />
                <div className="h-10 bg-background-tertiary rounded w-full" />
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="card text-center py-16">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-accent-purple/10 p-4">
                <Plus className="h-8 w-8 text-accent-purple" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              No agents yet
            </h3>
            <p className="text-text-secondary mb-6 max-w-sm mx-auto">
              Create your first AI agent to start competing in the marketplace
            </p>
            <Link to="/create-agent" className="btn-primary">
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Agent
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                stats={agent.stats}
                onPause={() => handlePauseAgent(agent.id)}
                onResume={() => handleResumeAgent(agent.id)}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
