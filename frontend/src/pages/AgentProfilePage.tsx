import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  DollarSign,
  Trophy,
  TrendingUp,
  Zap,
  RefreshCw,
  Edit3,
  Save,
  X,
  Pause,
  Play,
  Trash2,
  Clock,
  Target,
  BarChart3,
} from 'lucide-react';
import { Layout } from '@/components/layout';
import { SpecialtyBadge, StatCard, ProgressBar } from '@/components/ui';
import { agentsAPI, agentStatsAPI, AgentStatsData } from '@/lib/api';
import { cn, formatCredits, formatTimeAgo, getSpecialtyIcon } from '@/lib/utils';
import type { Agent } from '@/types';

export function AgentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [stats, setStats] = useState<AgentStatsData | null>(null);
  const [fullStats, setFullStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAuctionInstructions, setEditAuctionInstructions] = useState('');
  const [editBarterInstructions, setEditBarterInstructions] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const [agentData, statsData, fullStatsData] = await Promise.all([
          agentsAPI.get(id),
          agentStatsAPI.getStats(id).catch(() => null),
          agentStatsAPI.getFullStats(id).catch(() => null),
        ]);

        setAgent(agentData);
        setStats(statsData);
        setFullStats(fullStatsData);
        setEditName(agentData.name);
        setEditAuctionInstructions(agentData.auction_instructions);
        setEditBarterInstructions(agentData.barter_instructions);
      } catch (err) {
        console.error('Failed to fetch agent:', err);
        setError('Failed to load agent');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  const handleSave = async () => {
    if (!agent) return;
    setIsSaving(true);

    try {
      const updated = await agentsAPI.update(agent.id, {
        name: editName,
        auction_instructions: editAuctionInstructions,
        barter_instructions: editBarterInstructions,
      });
      setAgent(updated);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save agent:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!agent) return;

    try {
      const updated = await agentsAPI.update(agent.id, {
        is_active: !agent.is_active,
      });
      setAgent(updated);
    } catch (err) {
      console.error('Failed to toggle agent:', err);
    }
  };

  const handleDelete = async () => {
    if (!agent) return;
    setIsDeleting(true);

    try {
      await agentsAPI.delete(agent.id);
      navigate('/dashboard');
    } catch (err) {
      console.error('Failed to delete agent:', err);
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-background-tertiary rounded mb-4" />
            <div className="grid grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-background-tertiary rounded-lg" />
              ))}
            </div>
            <div className="h-96 bg-background-tertiary rounded-lg" />
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !agent) {
    return (
      <Layout>
        <div className="p-6">
          <div className="card p-12 text-center">
            <p className="text-text-secondary mb-4">{error || 'Agent not found'}</p>
            <Link to="/dashboard" className="btn-primary">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="btn-ghost p-2">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-background-tertiary flex items-center justify-center text-4xl">
                {getSpecialtyIcon(agent.specialty)}
              </div>
              <div>
                {isEditing ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="text-2xl font-bold bg-background-tertiary border border-border rounded px-3 py-1 text-text-primary focus:outline-none focus:border-accent-purple"
                  />
                ) : (
                  <h1 className="text-2xl font-bold text-text-primary">{agent.name}</h1>
                )}
                <div className="flex items-center gap-3 mt-1">
                  <SpecialtyBadge specialty={agent.specialty} />
                  <span
                    className={cn(
                      'flex items-center gap-1 text-sm',
                      agent.is_active ? 'text-accent-green' : 'text-text-muted'
                    )}
                  >
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full',
                        agent.is_active ? 'bg-accent-green' : 'bg-text-muted'
                      )}
                    />
                    {agent.is_active ? 'Active' : 'Paused'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditName(agent.name);
                    setEditAuctionInstructions(agent.auction_instructions);
                    setEditBarterInstructions(agent.barter_instructions);
                  }}
                  className="btn-ghost"
                >
                  <X className="mr-1 h-4 w-4" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="btn-primary"
                >
                  {isSaving ? (
                    <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-4 w-4" />
                  )}
                  Save Changes
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setIsEditing(true)} className="btn-secondary">
                  <Edit3 className="mr-1 h-4 w-4" />
                  Edit
                </button>
                <button onClick={handleToggleActive} className="btn-ghost">
                  {agent.is_active ? (
                    <>
                      <Pause className="mr-1 h-4 w-4" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="mr-1 h-4 w-4" />
                      Activate
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="btn-ghost text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Credits"
            value={formatCredits(agent.credits)}
            icon={DollarSign}
            iconColor="text-accent-cyan"
          />
          <StatCard
            label="Jobs Won"
            value={(stats?.jobs_won ?? 0).toString()}
            icon={Trophy}
            iconColor="text-accent-orange"
          />
          <StatCard
            label="Win Rate"
            value={`${stats?.win_rate ?? 0}%`}
            icon={TrendingUp}
            iconColor="text-accent-purple"
          />
          <StatCard
            label="Active Bids"
            value={(stats?.active_bids ?? 0).toString()}
            icon={Zap}
            iconColor="text-accent-green"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Instructions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Auction Instructions */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-4">
                <Zap className="h-5 w-5 text-accent-orange" />
                Auction Strategy
              </h3>
              {isEditing ? (
                <textarea
                  value={editAuctionInstructions}
                  onChange={(e) => setEditAuctionInstructions(e.target.value)}
                  className="w-full h-48 bg-background-tertiary border border-border rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-accent-purple resize-none"
                />
              ) : (
                <p className="text-text-secondary whitespace-pre-wrap">
                  {agent.auction_instructions}
                </p>
              )}
            </div>

            {/* Barter Instructions */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-4">
                <RefreshCw className="h-5 w-5 text-accent-cyan" />
                Barter Strategy
              </h3>
              {isEditing ? (
                <textarea
                  value={editBarterInstructions}
                  onChange={(e) => setEditBarterInstructions(e.target.value)}
                  className="w-full h-48 bg-background-tertiary border border-border rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-accent-purple resize-none"
                />
              ) : (
                <p className="text-text-secondary whitespace-pre-wrap">
                  {agent.barter_instructions}
                </p>
              )}
            </div>

            {/* Recent Activity */}
            {fullStats && (
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-4">
                  <Clock className="h-5 w-5 text-text-muted" />
                  Recent Activity
                </h3>
                {fullStats.recent_bids?.length > 0 ? (
                  <div className="space-y-3">
                    {fullStats.recent_bids.slice(0, 5).map((bid: any) => (
                      <div
                        key={bid.bid_id}
                        className="flex items-center justify-between py-2 border-b border-border last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'w-2 h-2 rounded-full',
                              bid.is_winning ? 'bg-accent-green' : 'bg-text-muted'
                            )}
                          />
                          <span className="text-text-secondary">
                            Bid {formatCredits(bid.amount)}
                          </span>
                        </div>
                        <span className="text-sm text-text-muted">
                          {formatTimeAgo(bid.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-muted text-center py-8">No recent activity</p>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Stats & Info */}
          <div className="space-y-6">
            {/* Current Status */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">Current Status</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-text-secondary">Workload</span>
                    <span className="text-text-primary font-medium">
                      {agent.current_jobs}/5 jobs
                    </span>
                  </div>
                  <ProgressBar
                    value={(agent.current_jobs / 5) * 100}
                    color={agent.current_jobs >= 4 ? 'orange' : 'purple'}
                    size="sm"
                  />
                </div>

                {stats && (
                  <>
                    <div className="flex items-center justify-between py-2 border-t border-border">
                      <span className="text-text-secondary">Total Earnings</span>
                      <span className="text-text-primary font-medium">
                        {formatCredits(stats.total_earnings)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-t border-border">
                      <span className="text-text-secondary">Total Bids</span>
                      <span className="text-text-primary font-medium">{stats.total_bids}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-t border-border">
                      <span className="text-text-secondary">Avg Bid Amount</span>
                      <span className="text-text-primary font-medium">
                        {formatCredits(stats.avg_bid_amount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-t border-border">
                      <span className="text-text-secondary">Active Trades</span>
                      <span className="text-text-primary font-medium">{stats.active_trades}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Recent Wins */}
            {fullStats?.recent_wins?.length > 0 && (
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-4">
                  <Trophy className="h-5 w-5 text-accent-orange" />
                  Recent Wins
                </h3>
                <div className="space-y-3">
                  {fullStats.recent_wins.slice(0, 5).map((win: any) => (
                    <div
                      key={win.auction_id}
                      className="p-3 bg-background-tertiary rounded-lg"
                    >
                      <p className="text-text-primary font-medium truncate">
                        {win.job_title}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-accent-green text-sm">
                          +{formatCredits(win.amount)}
                        </span>
                        <span className="text-text-muted text-xs">
                          {formatTimeAgo(win.closed_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Performance Breakdown */}
            {fullStats?.specialty_breakdown && Object.keys(fullStats.specialty_breakdown).length > 0 && (
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-4">
                  <BarChart3 className="h-5 w-5 text-accent-purple" />
                  Jobs by Type
                </h3>
                <div className="space-y-2">
                  {Object.entries(fullStats.specialty_breakdown).map(([spec, count]) => (
                    <div key={spec} className="flex items-center justify-between">
                      <span className="text-text-secondary capitalize">{spec.replace('_', ' ')}</span>
                      <span className="text-text-primary font-medium">{count as number}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="card p-6 max-w-md mx-4">
              <h3 className="text-lg font-semibold text-text-primary mb-2">Delete Agent?</h3>
              <p className="text-text-secondary mb-6">
                Are you sure you want to delete <strong>{agent.name}</strong>? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg px-4 py-2 font-medium transition-colors"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
