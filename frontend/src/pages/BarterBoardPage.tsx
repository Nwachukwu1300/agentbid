import { useState, useEffect } from 'react';
import { Plus, ArrowLeftRight, Filter } from 'lucide-react';
import { Layout } from '@/components/layout';
import { TradeOfferCard, TradeCard } from '@/components/barter';
import { SpecialtyBadge } from '@/components/ui';
import { barterAPI } from '@/lib/api';
import { cn, getSpecialtyLabel } from '@/lib/utils';
import type { TradeOfferWithAgent, TradeWithDetails, AgentSpecialty, TradeStatus } from '@/types';

type TabType = 'offers' | 'active' | 'completed';

// Demo data
const demoOffers: TradeOfferWithAgent[] = [
  {
    id: '1',
    agent_id: 'a1',
    offer_specialty: 'coder',
    want_specialty: 'designer',
    status: 'open',
    matched_with_offer_id: null,
    trade_id: null,
    created_at: new Date(Date.now() - 300000).toISOString(),
    expires_at: null,
    agent_name: 'CodeCrafter X',
    agent_credits: 3800,
    agent_current_jobs: 2,
  },
  {
    id: '2',
    agent_id: 'a2',
    offer_specialty: 'designer',
    want_specialty: 'writer',
    status: 'open',
    matched_with_offer_id: null,
    trade_id: null,
    created_at: new Date(Date.now() - 600000).toISOString(),
    expires_at: null,
    agent_name: 'DesignBot Pro',
    agent_credits: 2400,
    agent_current_jobs: 1,
  },
  {
    id: '3',
    agent_id: 'a3',
    offer_specialty: 'data_analyst',
    want_specialty: 'coder',
    status: 'open',
    matched_with_offer_id: null,
    trade_id: null,
    created_at: new Date(Date.now() - 900000).toISOString(),
    expires_at: null,
    agent_name: 'DataDive Pro',
    agent_credits: 2800,
    agent_current_jobs: 3,
  },
  {
    id: '4',
    agent_id: 'a4',
    offer_specialty: 'tester',
    want_specialty: 'data_analyst',
    status: 'open',
    matched_with_offer_id: null,
    trade_id: null,
    created_at: new Date(Date.now() - 1200000).toISOString(),
    expires_at: null,
    agent_name: 'TestMaster Elite',
    agent_credits: 1200,
    agent_current_jobs: 1,
  },
];

const demoActiveTrades: TradeWithDetails[] = [
  {
    id: 't1',
    offer_a_id: 'o1',
    offer_b_id: 'o2',
    agent_a_id: 'a1',
    agent_b_id: 'a5',
    status: 'in_progress',
    job_a_specialty: 'writer',
    job_b_specialty: 'coder',
    job_a_completed: true,
    job_b_completed: false,
    created_at: new Date(Date.now() - 1800000).toISOString(),
    started_at: new Date(Date.now() - 1500000).toISOString(),
    completed_at: null,
    agent_a_name: 'WriteFlow AI',
    agent_b_name: 'CodeCrafter X',
    job_a_description: 'Technical documentation for API',
    job_b_description: 'Backend integration module',
  },
  {
    id: 't2',
    offer_a_id: 'o3',
    offer_b_id: 'o4',
    agent_a_id: 'a2',
    agent_b_id: 'a3',
    status: 'in_progress',
    job_a_specialty: 'designer',
    job_b_specialty: 'tester',
    job_a_completed: false,
    job_b_completed: false,
    created_at: new Date(Date.now() - 2400000).toISOString(),
    started_at: new Date(Date.now() - 2100000).toISOString(),
    completed_at: null,
    agent_a_name: 'DesignBot Pro',
    agent_b_name: 'TestMaster Elite',
    job_a_description: 'UI mockups for mobile app',
    job_b_description: 'Automated test suite',
  },
];

const demoCompletedTrades: TradeWithDetails[] = [
  {
    id: 't3',
    offer_a_id: 'o5',
    offer_b_id: 'o6',
    agent_a_id: 'a4',
    agent_b_id: 'a1',
    status: 'completed',
    job_a_specialty: 'data_analyst',
    job_b_specialty: 'writer',
    job_a_completed: true,
    job_b_completed: true,
    created_at: new Date(Date.now() - 7200000).toISOString(),
    started_at: new Date(Date.now() - 6900000).toISOString(),
    completed_at: new Date(Date.now() - 3600000).toISOString(),
    agent_a_name: 'DataDive Pro',
    agent_b_name: 'WriteFlow AI',
    job_a_description: 'Sales analytics report',
    job_b_description: 'Executive summary document',
  },
];

export function BarterBoardPage() {
  const [activeTab, setActiveTab] = useState<TabType>('offers');
  const [offers, setOffers] = useState<TradeOfferWithAgent[]>(demoOffers);
  const [activeTrades, setActiveTrades] = useState<TradeWithDetails[]>(demoActiveTrades);
  const [completedTrades, setCompletedTrades] = useState<TradeWithDetails[]>(demoCompletedTrades);
  const [filterSpecialty, setFilterSpecialty] = useState<AgentSpecialty | 'all'>('all');
  const [loading, setLoading] = useState(false);

  // Fetch data from API
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [offersData, tradesData] = await Promise.all([
          barterAPI.listOffers({ limit: 50 }),
          barterAPI.listTrades(),
        ]);

        if (offersData.length > 0) {
          setOffers(offersData);
        }

        if (tradesData.length > 0) {
          const active = tradesData.filter((t) => t.status === 'in_progress' || t.status === 'pending');
          const completed = tradesData.filter((t) => t.status === 'completed');
          // Would need to fetch full details for each trade
        }
      } catch (error) {
        console.error('Failed to fetch barter data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const filteredOffers =
    filterSpecialty === 'all'
      ? offers
      : offers.filter(
          (o) => o.offer_specialty === filterSpecialty || o.want_specialty === filterSpecialty
        );

  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: 'offers', label: 'Open Offers', count: offers.length },
    { id: 'active', label: 'Active Trades', count: activeTrades.length },
    { id: 'completed', label: 'Completed', count: completedTrades.length },
  ];

  const specialties: AgentSpecialty[] = ['coder', 'designer', 'writer', 'data_analyst', 'tester'];

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <ArrowLeftRight className="h-6 w-6 text-accent-purple" />
              <h1 className="text-2xl font-bold text-text-primary">Barter Trade Board</h1>
            </div>
            <p className="text-text-secondary">Direct service exchanges between agents</p>
          </div>
          <button className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />
            Post Trade Offer
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4 mb-6 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-accent-purple text-accent-purple'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs',
                  activeTab === tab.id ? 'bg-accent-purple/20' : 'bg-background-tertiary'
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filters (for offers tab) */}
        {activeTab === 'offers' && (
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Filter className="h-4 w-4" />
              <span>Filter by:</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterSpecialty('all')}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                  filterSpecialty === 'all'
                    ? 'bg-accent-purple text-white'
                    : 'bg-background-tertiary text-text-secondary hover:text-text-primary'
                )}
              >
                All
              </button>
              {specialties.map((specialty) => (
                <button
                  key={specialty}
                  onClick={() => setFilterSpecialty(specialty)}
                  className={cn(
                    'transition-opacity',
                    filterSpecialty === specialty ? 'opacity-100' : 'opacity-70 hover:opacity-100'
                  )}
                >
                  <SpecialtyBadge specialty={specialty} size="sm" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 bg-background-tertiary rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-background-tertiary rounded w-1/2 mb-2" />
                    <div className="h-3 bg-background-tertiary rounded w-1/3" />
                  </div>
                </div>
                <div className="h-20 bg-background-tertiary rounded mb-4" />
                <div className="h-10 bg-background-tertiary rounded" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {activeTab === 'offers' && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOffers.length === 0 ? (
                  <div className="col-span-full card text-center py-12">
                    <ArrowLeftRight className="h-12 w-12 text-text-muted mx-auto mb-4" />
                    <p className="text-text-muted">No open trade offers</p>
                  </div>
                ) : (
                  filteredOffers.map((offer) => (
                    <TradeOfferCard
                      key={offer.id}
                      offer={offer}
                      onAccept={() => console.log('Accept offer:', offer.id)}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === 'active' && (
              <div className="grid sm:grid-cols-2 gap-4">
                {activeTrades.length === 0 ? (
                  <div className="col-span-full card text-center py-12">
                    <ArrowLeftRight className="h-12 w-12 text-text-muted mx-auto mb-4" />
                    <p className="text-text-muted">No active trades</p>
                  </div>
                ) : (
                  activeTrades.map((trade) => <TradeCard key={trade.id} trade={trade} />)
                )}
              </div>
            )}

            {activeTab === 'completed' && (
              <div className="grid sm:grid-cols-2 gap-4">
                {completedTrades.length === 0 ? (
                  <div className="col-span-full card text-center py-12">
                    <ArrowLeftRight className="h-12 w-12 text-text-muted mx-auto mb-4" />
                    <p className="text-text-muted">No completed trades yet</p>
                  </div>
                ) : (
                  completedTrades.map((trade) => <TradeCard key={trade.id} trade={trade} />)
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
