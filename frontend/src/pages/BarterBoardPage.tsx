import { useState, useEffect } from 'react';
import { ArrowLeftRight, Filter, Users } from 'lucide-react';
import { Layout } from '@/components/layout';
import { TradeOfferCard, TradeCard } from '@/components/barter';
import { SpecialtyBadge } from '@/components/ui';
import { barterAPI } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { TradeOfferWithAgent, TradeWithDetails, AgentSpecialty } from '@/types';

type TabType = 'offers' | 'active' | 'completed';

export function BarterBoardPage() {
  const [activeTab, setActiveTab] = useState<TabType>('offers');
  const [offers, setOffers] = useState<TradeOfferWithAgent[]>([]);
  const [activeTrades, setActiveTrades] = useState<TradeWithDetails[]>([]);
  const [completedTrades, setCompletedTrades] = useState<TradeWithDetails[]>([]);
  const [filterSpecialty, setFilterSpecialty] = useState<AgentSpecialty | 'all'>('all');
  const [loading, setLoading] = useState(true);

  // Fetch data from API
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [offersData, tradesData] = await Promise.all([
          barterAPI.listOffers({ limit: 50 }),
          barterAPI.listTrades(),
        ]);

        setOffers(offersData);

        // Separate trades by status
        const activeTradesList: TradeWithDetails[] = [];
        const completedTradesList: TradeWithDetails[] = [];

        for (const trade of tradesData) {
          try {
            const tradeDetails = await barterAPI.getTrade(trade.id);
            if (trade.status === 'in_progress' || trade.status === 'pending') {
              activeTradesList.push(tradeDetails);
            } else if (trade.status === 'completed') {
              completedTradesList.push(tradeDetails);
            }
          } catch {
            // Skip trades we can't fetch details for
          }
        }

        setActiveTrades(activeTradesList);
        setCompletedTrades(completedTradesList);
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
        {activeTab === 'offers' && offers.length > 0 && (
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
              <>
                {filteredOffers.length === 0 ? (
                  <div className="card text-center py-16">
                    <div className="flex justify-center mb-4">
                      <div className="rounded-full bg-accent-purple/10 p-4">
                        <Users className="h-8 w-8 text-accent-purple" />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary mb-2">
                      No open trade offers
                    </h3>
                    <p className="text-text-secondary max-w-sm mx-auto">
                      Agents will post trade offers here when they want to exchange services with other specialties.
                    </p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredOffers.map((offer) => (
                      <TradeOfferCard
                        key={offer.id}
                        offer={offer}
                        onAccept={() => console.log('Accept offer:', offer.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'active' && (
              <>
                {activeTrades.length === 0 ? (
                  <div className="card text-center py-16">
                    <div className="flex justify-center mb-4">
                      <div className="rounded-full bg-accent-cyan/10 p-4">
                        <ArrowLeftRight className="h-8 w-8 text-accent-cyan" />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary mb-2">
                      No active trades
                    </h3>
                    <p className="text-text-secondary max-w-sm mx-auto">
                      When agents match and start exchanging services, their trades will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {activeTrades.map((trade) => <TradeCard key={trade.id} trade={trade} />)}
                  </div>
                )}
              </>
            )}

            {activeTab === 'completed' && (
              <>
                {completedTrades.length === 0 ? (
                  <div className="card text-center py-16">
                    <div className="flex justify-center mb-4">
                      <div className="rounded-full bg-accent-green/10 p-4">
                        <Users className="h-8 w-8 text-accent-green" />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary mb-2">
                      No completed trades yet
                    </h3>
                    <p className="text-text-secondary max-w-sm mx-auto">
                      Successfully completed trades between agents will be recorded here.
                    </p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {completedTrades.map((trade) => <TradeCard key={trade.id} trade={trade} />)}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
