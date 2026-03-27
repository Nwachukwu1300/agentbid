import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout';
import { AuctionCard, ActivityFeed } from '@/components/auction';
import { LiveIndicator } from '@/components/ui';
import { auctionsAPI } from '@/lib/api';
import { cn, getSpecialtyLabel } from '@/lib/utils';
import type { AuctionWithJob, AgentSpecialty } from '@/types';

const specialtyFilters: (AgentSpecialty | 'all')[] = [
  'all',
  'coder',
  'designer',
  'writer',
  'tester',
  'data_analyst',
];

// Demo data for development
const demoAuctions: AuctionWithJob[] = [
  {
    id: '1',
    job_id: 'j1',
    job_title: 'Build Responsive Dashboard UI',
    job_description: 'Create a modern React + Tailwind dashboard with dark mode support, real-time charts, and a full auth flow. Must be...',
    job_specialty: 'coder',
    job_base_price: 500,
    duration_seconds: 98,
    status: 'active',
    winning_bid_id: null,
    winning_agent_id: null,
    winning_amount: null,
    started_at: new Date(Date.now() - 22000).toISOString(),
    ends_at: new Date(Date.now() + 98000).toISOString(),
    closed_at: null,
    bid_count: 12,
    lowest_bid: 270,
  },
  {
    id: '2',
    job_id: 'j2',
    job_title: 'Mobile App UI Design System',
    job_description: 'Design a comprehensive UI kit for iOS/Android app including components, icons, color tokens, and a full style guide in...',
    job_specialty: 'designer',
    job_base_price: 400,
    duration_seconds: 214,
    status: 'active',
    winning_bid_id: null,
    winning_agent_id: null,
    winning_amount: null,
    started_at: new Date(Date.now() - 6000).toISOString(),
    ends_at: new Date(Date.now() + 214000).toISOString(),
    closed_at: null,
    bid_count: 8,
    lowest_bid: 212,
  },
  {
    id: '3',
    job_id: 'j3',
    job_title: 'E-commerce Platform QA Testing',
    job_description: 'Write and execute comprehensive automated tests for checkout flow, payment processing, inventory management...',
    job_specialty: 'tester',
    job_base_price: 350,
    duration_seconds: 370,
    status: 'active',
    winning_bid_id: null,
    winning_agent_id: null,
    winning_amount: null,
    started_at: new Date(Date.now() - 50000).toISOString(),
    ends_at: new Date(Date.now() + 370000).toISOString(),
    closed_at: null,
    bid_count: 9,
    lowest_bid: 171,
  },
  {
    id: '4',
    job_id: 'j4',
    job_title: 'SaaS Product Blog Post Series',
    job_description: 'Write 5 SEO-optimized blog posts (1500 words each) on AI tools, productivity, and remote work trends for a B2B SaaS...',
    job_specialty: 'writer',
    job_base_price: 250,
    duration_seconds: 27,
    status: 'active',
    winning_bid_id: null,
    winning_agent_id: null,
    winning_amount: null,
    started_at: new Date(Date.now() - 93000).toISOString(),
    ends_at: new Date(Date.now() + 27000).toISOString(),
    closed_at: null,
    bid_count: 9,
    lowest_bid: 108,
  },
  {
    id: '5',
    job_id: 'j5',
    job_title: 'Customer Churn Prediction Model',
    job_description: 'Build a machine learning model to predict customer churn using historical data. Include feature engineering, model...',
    job_specialty: 'data_analyst',
    job_base_price: 450,
    duration_seconds: 180,
    status: 'active',
    winning_bid_id: null,
    winning_agent_id: null,
    winning_amount: null,
    started_at: new Date(Date.now() - 30000).toISOString(),
    ends_at: new Date(Date.now() + 180000).toISOString(),
    closed_at: null,
    bid_count: 6,
    lowest_bid: 295,
  },
  {
    id: '6',
    job_id: 'j6',
    job_title: 'REST API Development',
    job_description: 'Design and implement a RESTful API with authentication, rate limiting, and comprehensive documentation using FastAPI...',
    job_specialty: 'coder',
    job_base_price: 400,
    duration_seconds: 150,
    status: 'active',
    winning_bid_id: null,
    winning_agent_id: null,
    winning_amount: null,
    started_at: new Date(Date.now() - 70000).toISOString(),
    ends_at: new Date(Date.now() + 150000).toISOString(),
    closed_at: null,
    bid_count: 14,
    lowest_bid: 283,
  },
];

export function LiveAuctionsPage() {
  const [auctions, setAuctions] = useState<AuctionWithJob[]>(demoAuctions);
  const [selectedFilter, setSelectedFilter] = useState<AgentSpecialty | 'all'>('all');
  const [loading, setLoading] = useState(false);

  // Fetch auctions from API
  useEffect(() => {
    async function fetchAuctions() {
      setLoading(true);
      try {
        const data = await auctionsAPI.listActive({
          specialty: selectedFilter === 'all' ? undefined : selectedFilter,
          limit: 50,
        });
        if (data.length > 0) {
          setAuctions(data);
        }
      } catch (error) {
        console.error('Failed to fetch auctions:', error);
        // Keep demo data on error
      } finally {
        setLoading(false);
      }
    }

    fetchAuctions();
    const interval = setInterval(fetchAuctions, 10000); // Refresh every 10s

    return () => clearInterval(interval);
  }, [selectedFilter]);

  const filteredAuctions =
    selectedFilter === 'all'
      ? auctions
      : auctions.filter((a) => a.job_specialty === selectedFilter);

  const getFilterCount = (filter: AgentSpecialty | 'all') => {
    if (filter === 'all') return auctions.length;
    return auctions.filter((a) => a.job_specialty === filter).length;
  };

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-text-primary">Live Auctions</h1>
              <LiveIndicator label={`${auctions.length} live`} />
            </div>
            <p className="text-text-secondary">Watch autonomous agents bid in real-time</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {specialtyFilters.map((filter) => {
            const count = getFilterCount(filter);
            return (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap',
                  selectedFilter === filter
                    ? 'bg-accent-purple text-white'
                    : 'bg-background-tertiary text-text-secondary hover:bg-background-hover hover:text-text-primary'
                )}
              >
                {filter === 'all' ? 'All' : getSpecialtyLabel(filter)}
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded-full text-xs',
                    selectedFilter === filter
                      ? 'bg-white/20 text-white'
                      : 'bg-background-card text-text-muted'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Auctions Grid */}
          <div className="lg:col-span-2">
            {loading && auctions.length === 0 ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="card animate-pulse">
                    <div className="h-4 bg-background-tertiary rounded w-1/3 mb-4" />
                    <div className="h-5 bg-background-tertiary rounded w-3/4 mb-2" />
                    <div className="h-4 bg-background-tertiary rounded w-full mb-4" />
                    <div className="h-8 bg-background-tertiary rounded w-full" />
                  </div>
                ))}
              </div>
            ) : filteredAuctions.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-text-muted">No active auctions found</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {filteredAuctions.map((auction) => (
                  <AuctionCard
                    key={auction.id}
                    auction={auction}
                    onExpire={() => {
                      // Remove expired auction from list
                      setAuctions((prev) => prev.filter((a) => a.id !== auction.id));
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Activity Feed Sidebar */}
          <div className="lg:col-span-1">
            <ActivityFeed maxItems={8} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
