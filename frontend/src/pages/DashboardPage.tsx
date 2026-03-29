import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, DollarSign, Trophy, TrendingUp, Zap, LogOut } from 'lucide-react';
import { Layout } from '@/components/layout';
import { AgentCard } from '@/components/agent';
import { StatCard } from '@/components/ui';
import { agentsAPI, agentStatsAPI } from '@/lib/api';
import { formatCredits } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import type { Agent, AgentStats } from '@/types';

export function DashboardPage() {
  const { user, signOut } = useAuth();
  const [agents, setAgents] = useState<(Agent & { stats: AgentStats })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate aggregate stats
  const totalEarnings = agents.reduce((sum, a) => sum + a.stats.total_earnings, 0);
  const totalJobsWon = agents.reduce((sum, a) => sum + a.stats.jobs_won, 0);
  const avgWinRate = agents.length > 0
    ? Math.round(agents.reduce((sum, a) => sum + a.stats.win_rate, 0) / agents.length)
    : 0;
  const totalActiveBids = agents.reduce((sum, a) => sum + a.stats.active_bids, 0);

  // Fetch user's agents from API
  useEffect(() => {
    async function fetchMyAgents() {
      setLoading(true);
      setError(null);
      try {
        // Fetch user's agents only
        const data = await agentsAPI.getMyAgents(true);

        // Fetch stats for each agent
        const withStats = await Promise.all(
          data.map(async (agent) => {
            try {
              const stats = await agentStatsAPI.getStats(agent.id);
              return { ...agent, stats };
            } catch {
              // Return default stats if fetch fails
              return {
                ...agent,
                stats: {
                  total_earnings: 0,
                  jobs_won: 0,
                  win_rate: 0,
                  active_bids: 0,
                },
              };
            }
          })
        );

        setAgents(withStats);
      } catch (err) {
        console.error('Failed to fetch agents:', err);
        setError('Failed to load your agents. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchMyAgents();
  }, []);

  const handleToggleActive = async (agentId: string) => {
    try {
      const updated = await agentsAPI.toggleActive(agentId);
      setAgents((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, is_active: updated.is_active } : a))
      );
    } catch (err) {
      console.error('Failed to toggle agent:', err);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-1">My Agents</h1>
            <p className="text-text-secondary">
              {user?.email} - {agents.length} agent{agents.length !== 1 ? 's' : ''} in your fleet
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background-tertiary text-text-secondary hover:text-text-primary hover:bg-background-hover transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
            <Link to="/create-agent" className="btn-primary">
              <Plus className="mr-2 h-4 w-4" />
              Create Agent
            </Link>
          </div>
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

        {/* Error state */}
        {error && (
          <div className="card bg-red-500/10 border-red-500/30 text-red-400 mb-6">
            <p>{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-sm underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

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
                onPause={() => handleToggleActive(agent.id)}
                onResume={() => handleToggleActive(agent.id)}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
