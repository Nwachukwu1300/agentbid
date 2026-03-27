// Agent types
export type AgentSpecialty = 'designer' | 'coder' | 'writer' | 'data_analyst' | 'tester';

export interface Agent {
  id: string;
  user_id: string;
  name: string;
  specialty: AgentSpecialty;
  auction_instructions: string;
  barter_instructions: string;
  credits: number;
  current_jobs: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentStats {
  total_earnings: number;
  jobs_won: number;
  win_rate: number;
  active_bids: number;
}

// Auction types
export type AuctionStatus = 'active' | 'closed' | 'cancelled';

export interface Auction {
  id: string;
  job_id: string;
  duration_seconds: number;
  status: AuctionStatus;
  winning_bid_id: string | null;
  winning_agent_id: string | null;
  winning_amount: number | null;
  started_at: string;
  ends_at: string;
  closed_at: string | null;
}

export interface AuctionWithJob extends Auction {
  job_title: string;
  job_description: string;
  job_specialty: AgentSpecialty;
  job_base_price: number;
  bid_count: number;
  lowest_bid: number | null;
}

export interface Bid {
  id: string;
  auction_id: string;
  agent_id: string;
  amount: number;
  created_at: string;
  is_winning: boolean;
}

export interface BidWithAgent extends Bid {
  agent_name: string;
  agent_specialty: AgentSpecialty;
}

export interface AuctionResult {
  auction_id: string;
  job_id: string;
  winner_agent_id: string | null;
  winner_agent_name: string | null;
  winning_bid: number | null;
  total_bids: number;
  status: AuctionStatus;
}

// Job types
export type JobStatus = 'pending' | 'in_auction' | 'assigned' | 'in_progress' | 'completed';

export interface Job {
  id: string;
  title: string;
  description: string;
  specialty: AgentSpecialty;
  base_price: number;
  status: JobStatus;
  assigned_agent_id: string | null;
  winning_bid: number | null;
  created_at: string;
  completed_at: string | null;
}

// Barter types
export type TradeOfferStatus = 'open' | 'matched' | 'cancelled' | 'expired';
export type TradeStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface TradeOffer {
  id: string;
  agent_id: string;
  offer_specialty: AgentSpecialty;
  want_specialty: AgentSpecialty;
  status: TradeOfferStatus;
  matched_with_offer_id: string | null;
  trade_id: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface TradeOfferWithAgent extends TradeOffer {
  agent_name: string;
  agent_credits: number;
  agent_current_jobs: number;
}

export interface Trade {
  id: string;
  offer_a_id: string;
  offer_b_id: string;
  agent_a_id: string;
  agent_b_id: string;
  status: TradeStatus;
  job_a_specialty: AgentSpecialty;
  job_b_specialty: AgentSpecialty;
  job_a_completed: boolean;
  job_b_completed: boolean;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface TradeWithDetails extends Trade {
  agent_a_name: string;
  agent_b_name: string;
  job_a_description: string | null;
  job_b_description: string | null;
}

// SSE Event types
export type SSEEventType =
  | 'auction_created'
  | 'bid_placed'
  | 'auction_closed'
  | 'trade_created'
  | 'trade_completed'
  | 'agent_decision';

export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  timestamp: string;
}

export interface BidPlacedEvent {
  auction_id: string;
  bid: BidWithAgent;
  reasoning?: string;
}

export interface AuctionClosedEvent {
  result: AuctionResult;
}

// Activity feed item
export interface ActivityItem {
  id: string;
  type: SSEEventType;
  title: string;
  description: string;
  agent_name?: string;
  agent_specialty?: AgentSpecialty;
  amount?: number;
  timestamp: string;
}

// Stats for dashboard
export interface MarketStats {
  total_volume: number;
  volume_change: number;
  avg_winning_bid: number;
  avg_bid_change: number;
  active_agents: number;
  agents_change: number;
  jobs_completed: number;
  jobs_change: number;
}

export interface LeaderboardEntry {
  rank: number;
  agent_id: string;
  agent_name: string;
  specialty: AgentSpecialty;
  earnings: number;
  jobs_won: number;
  win_rate: number;
}
