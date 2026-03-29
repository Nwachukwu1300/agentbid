import { supabase } from './supabase';
import type {
  Agent,
  AuctionWithJob,
  Bid,
  BidWithAgent,
  TradeOfferWithAgent,
  Trade,
  TradeWithDetails,
  AgentSpecialty,
  TradeStatus,
  AgentStats,
  MarketStats,
  LeaderboardEntry,
} from '@/types';

const API_BASE = '/api';

// Get current access token from Supabase session
async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// Base fetch with optional authentication
async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit & { requireAuth?: boolean }
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  // Add auth token if available or required
  if (options?.requireAuth !== false) {
    const token = await getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (options?.requireAuth) {
      throw new Error('Authentication required');
    }
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP error ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// =============================================================================
// AGENTS API
// =============================================================================

export const agentsAPI = {
  // Public: List all agents (marketplace view)
  list: (params?: { specialty?: AgentSpecialty; is_active?: boolean; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.specialty) searchParams.set('specialty', params.specialty);
    if (params?.is_active !== undefined) searchParams.set('is_active', String(params.is_active));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    return fetchAPI<Agent[]>(`/agents?${searchParams}`, { requireAuth: false });
  },

  // Public: Get single agent
  get: (id: string) => fetchAPI<Agent>(`/agents/${id}`, { requireAuth: false }),

  // Authenticated: Get current user's agents
  getMyAgents: (includeInactive = true) => {
    const searchParams = new URLSearchParams();
    searchParams.set('include_inactive', String(includeInactive));
    return fetchAPI<Agent[]>(`/agents/my/agents?${searchParams}`, { requireAuth: true });
  },

  // Legacy: Get agents by user ID (public)
  getByUser: (userId: string) => fetchAPI<Agent[]>(`/agents/user/${userId}`, { requireAuth: false }),

  // Authenticated: Create new agent
  create: (data: {
    name: string;
    specialty: AgentSpecialty;
    auction_instructions: string;
    barter_instructions: string;
  }) => fetchAPI<Agent>('/agents', {
    method: 'POST',
    body: JSON.stringify(data),
    requireAuth: true,
  }),

  // Authenticated: Update agent (must own it)
  update: (id: string, data: Partial<Agent>) =>
    fetchAPI<Agent>(`/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      requireAuth: true,
    }),

  // Authenticated: Delete agent (must own it)
  delete: (id: string) =>
    fetchAPI<void>(`/agents/${id}`, {
      method: 'DELETE',
      requireAuth: true,
    }),

  // Authenticated: Toggle agent active status
  toggleActive: (id: string) =>
    fetchAPI<Agent>(`/agents/${id}/toggle-active`, {
      method: 'POST',
      requireAuth: true,
    }),
};

// =============================================================================
// AGENT STATS API
// =============================================================================

export const agentStatsAPI = {
  // Get stats for a single agent
  getStats: (agentId: string) =>
    fetchAPI<AgentStats>(`/agents/${agentId}/stats`, { requireAuth: false }),

  // Get full stats with recent activity
  getFullStats: (agentId: string) =>
    fetchAPI<AgentStats & { recent_activity: unknown[] }>(`/agents/${agentId}/full-stats`, { requireAuth: false }),

  // Get dashboard stats for a user's agents
  getDashboardStats: (userId: string) =>
    fetchAPI<{
      total_agents: number;
      active_agents: number;
      total_earnings: number;
      total_jobs_won: number;
      total_active_bids: number;
    }>(`/agents/user/${userId}/dashboard-stats`, { requireAuth: false }),
};

// =============================================================================
// AGENT BUILDER API
// =============================================================================

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GeneratedInstructions {
  auction_instructions: string;
  barter_instructions: string;
}

export const agentBuilderAPI = {
  // Get initial prompt for a specialty
  getInitialPrompt: (specialty: AgentSpecialty) =>
    fetchAPI<{ prompt: string }>(`/agent-builder/initial-prompt/${specialty}`, { requireAuth: false }),

  // Chat with the agent builder
  chat: (data: { specialty: AgentSpecialty; messages: ConversationMessage[]; user_message: string }) =>
    fetchAPI<{ response: string; messages: ConversationMessage[] }>('/agent-builder/chat', {
      method: 'POST',
      body: JSON.stringify(data),
      requireAuth: false,
    }),

  // Generate instructions from conversation
  generate: (data: { specialty: AgentSpecialty; messages: ConversationMessage[] }) =>
    fetchAPI<GeneratedInstructions>('/agent-builder/generate', {
      method: 'POST',
      body: JSON.stringify(data),
      requireAuth: false,
    }),

  // Quick generate without conversation
  quickGenerate: (data: { specialty: AgentSpecialty; strategy_description: string }) =>
    fetchAPI<GeneratedInstructions>('/agent-builder/quick-generate', {
      method: 'POST',
      body: JSON.stringify(data),
      requireAuth: false,
    }),

  // Refine existing instructions
  refine: (data: { instructions: GeneratedInstructions; feedback: string }) =>
    fetchAPI<GeneratedInstructions>('/agent-builder/refine', {
      method: 'POST',
      body: JSON.stringify(data),
      requireAuth: false,
    }),
};

// =============================================================================
// AUCTIONS API
// =============================================================================

export const auctionsAPI = {
  listActive: (params?: { specialty?: AgentSpecialty; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.specialty) searchParams.set('specialty', params.specialty);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    return fetchAPI<AuctionWithJob[]>(`/auctions?${searchParams}`, { requireAuth: false });
  },

  get: (id: string) => fetchAPI<AuctionWithJob>(`/auctions/${id}`, { requireAuth: false }),

  getBids: (id: string, limit?: number) => {
    const searchParams = new URLSearchParams();
    if (limit) searchParams.set('limit', String(limit));
    return fetchAPI<Bid[]>(`/auctions/${id}/bids?${searchParams}`, { requireAuth: false });
  },

  getBidHistory: (id: string, limit?: number) => {
    const searchParams = new URLSearchParams();
    if (limit) searchParams.set('limit', String(limit));
    return fetchAPI<BidWithAgent[]>(`/auctions/${id}/bids/history?${searchParams}`, { requireAuth: false });
  },

  placeBid: (auctionId: string, agentId: string, amount: number) =>
    fetchAPI<Bid>(`/auctions/${auctionId}/bids?agent_id=${agentId}&amount=${amount}`, { method: 'POST' }),

  close: (id: string) =>
    fetchAPI<unknown>(`/auctions/${id}/close`, { method: 'POST' }),
};

// =============================================================================
// BARTER API
// =============================================================================

export const barterAPI = {
  listOffers: (params?: { offer_specialty?: AgentSpecialty; want_specialty?: AgentSpecialty; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.offer_specialty) searchParams.set('offer_specialty', params.offer_specialty);
    if (params?.want_specialty) searchParams.set('want_specialty', params.want_specialty);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    return fetchAPI<TradeOfferWithAgent[]>(`/barter/offers?${searchParams}`, { requireAuth: false });
  },

  getOffer: (id: string) => fetchAPI<TradeOfferWithAgent>(`/barter/offers/${id}`, { requireAuth: false }),

  createOffer: (data: { agent_id: string; offer_specialty: AgentSpecialty; want_specialty: AgentSpecialty }) =>
    fetchAPI<TradeOfferWithAgent>('/barter/offers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  cancelOffer: (id: string) =>
    fetchAPI<TradeOfferWithAgent>(`/barter/offers/${id}`, { method: 'DELETE' }),

  listTrades: (status?: TradeStatus) => {
    const searchParams = new URLSearchParams();
    if (status) searchParams.set('status', status);
    return fetchAPI<Trade[]>(`/barter/trades?${searchParams}`, { requireAuth: false });
  },

  getTrade: (id: string) => fetchAPI<TradeWithDetails>(`/barter/trades/${id}`, { requireAuth: false }),

  getAgentTrades: (agentId: string, status?: TradeStatus) => {
    const searchParams = new URLSearchParams();
    if (status) searchParams.set('status', status);
    return fetchAPI<Trade[]>(`/barter/trades/agent/${agentId}?${searchParams}`, { requireAuth: false });
  },
};

// =============================================================================
// ANALYTICS API
// =============================================================================

export const analyticsAPI = {
  getMarketStats: () =>
    fetchAPI<MarketStats>('/analytics/market-stats', { requireAuth: false }),

  getLeaderboard: (limit = 10) =>
    fetchAPI<LeaderboardEntry[]>(`/analytics/leaderboard?limit=${limit}`, { requireAuth: false }),

  getSpecialtyTrends: () =>
    fetchAPI<Record<AgentSpecialty, { avg_price: number; job_count: number }>>('/analytics/specialty-trends', { requireAuth: false }),
};

// =============================================================================
// JOBS API
// =============================================================================

export const jobsAPI = {
  list: (params?: { specialty?: AgentSpecialty; status?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.specialty) searchParams.set('specialty', params.specialty);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    return fetchAPI<unknown[]>(`/jobs?${searchParams}`, { requireAuth: false });
  },
};

// =============================================================================
// USERS API
// =============================================================================

export const usersAPI = {
  // Get current user profile
  getMe: () => fetchAPI<{ id: string; email: string; created_at: string }>('/users/me', { requireAuth: true }),

  // Update current user
  updateMe: (data: { email?: string }) =>
    fetchAPI<{ id: string; email: string }>('/users/me', {
      method: 'PUT',
      body: JSON.stringify(data),
      requireAuth: true,
    }),
};
