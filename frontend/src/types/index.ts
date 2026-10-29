// Agent types
export type AgentSpecialty = 'designer' | 'coder' | 'writer' | 'data_analyst' | 'tester';

export interface Agent {
  id: string;
  user_id: string;
  name: string;
  specialty: AgentSpecialty;
  auction_instructions: string;
  credits: number;
  current_jobs: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentStats {
  agent_id: string;
  total_earnings: number;
  jobs_won: number;
  jobs_completed: number;
  win_rate: number;
  active_bids: number;
  total_bids: number;
  avg_bid_amount: number;
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
  leading_agent_id: string | null;
  winning_agent_name: string | null;
}

// Phase 3: why agents won or lost (mirrors backend/app/services/decision_service.py)
export type DecisionKind = 'bid' | 'pass';

export interface DecisionEntry {
  id: string;
  agent_id: string;
  auction_id: string;
  decision_type: DecisionKind;
  bid_amount: number | null;
  reasoning: string;
  created_at: string;
  agent_name: string;
  agent_specialty: AgentSpecialty | null;
}

export type AgentOutcomeKind = 'won' | 'lost' | 'sealed' | 'passed' | 'no_winner';

export interface AgentOutcome {
  agent_id: string;
  agent_name: string;
  specialty: AgentSpecialty | null;
  best_bid: number | null;
  work_cost: number | null;
  last_reasoning: string | null;
  outcome: AgentOutcomeKind;
  explanation: string;
}

export interface AuctionBreakdown {
  auction: AuctionWithJob;
  work_cost: number;
  decisions: DecisionEntry[];
  agents: AgentOutcome[];
}

export interface AgentDecisionHistoryItem {
  id: string;
  auction_id: string;
  decision_type: DecisionKind;
  bid_amount: number | null;
  reasoning: string;
  created_at: string;
  job_title: string;
  job_specialty: AgentSpecialty | null;
  auction_status: AuctionStatus | null;
  winning_amount: number | null;
  outcome: 'won' | 'lost' | 'open' | 'no_winner';
}

export interface Bid {
  id: string;
  auction_id: string;
  agent_id: string;
  amount: number;
  created_at: string;
  is_winning: boolean;
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

// SSE Event types
export type SSEEventType =
  | 'auction_created'
  | 'bid_placed'
  | 'auction_closed'
  | 'season_ended'
  | 'agent_decision';

export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  timestamp: string;
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
  auction_id?: string;
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
  credits: number;
  profit: number;
  jobs_won: number;
  win_rate: number;
  bankrupt: boolean;
}

export interface Season {
  id: string;
  number: number;
  status: 'active' | 'finished';
  started_at: string;
  ends_at: string;
}
