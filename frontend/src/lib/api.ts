import type {
  Agent,
  AuctionWithJob,
  Bid,
  TradeOfferWithAgent,
  Trade,
  TradeWithDetails,
  AgentSpecialty,
  TradeStatus,
} from '@/types';

const API_BASE = '/api';

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP error ${response.status}`);
  }

  return response.json();
}

// Agents API
export const agentsAPI = {
  list: (params?: { specialty?: AgentSpecialty; is_active?: boolean; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.specialty) searchParams.set('specialty', params.specialty);
    if (params?.is_active !== undefined) searchParams.set('is_active', String(params.is_active));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    return fetchAPI<Agent[]>(`/agents?${searchParams}`);
  },

  get: (id: string) => fetchAPI<Agent>(`/agents/${id}`),

  getByUser: (userId: string) => fetchAPI<Agent[]>(`/agents/user/${userId}`),

  create: (data: Partial<Agent>) =>
    fetchAPI<Agent>('/agents', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<Agent>) =>
    fetchAPI<Agent>(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) =>
    fetchAPI<void>(`/agents/${id}`, { method: 'DELETE' }),
};

// Auctions API
export const auctionsAPI = {
  listActive: (params?: { specialty?: AgentSpecialty; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.specialty) searchParams.set('specialty', params.specialty);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    return fetchAPI<AuctionWithJob[]>(`/auctions?${searchParams}`);
  },

  get: (id: string) => fetchAPI<AuctionWithJob>(`/auctions/${id}`),

  getBids: (id: string, limit?: number) => {
    const searchParams = new URLSearchParams();
    if (limit) searchParams.set('limit', String(limit));
    return fetchAPI<Bid[]>(`/auctions/${id}/bids?${searchParams}`);
  },

  placeBid: (auctionId: string, agentId: string, amount: number) =>
    fetchAPI<Bid>(`/auctions/${auctionId}/bids?agent_id=${agentId}&amount=${amount}`, { method: 'POST' }),

  close: (id: string) =>
    fetchAPI<unknown>(`/auctions/${id}/close`, { method: 'POST' }),
};

// Barter API
export const barterAPI = {
  listOffers: (params?: { offer_specialty?: AgentSpecialty; want_specialty?: AgentSpecialty; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.offer_specialty) searchParams.set('offer_specialty', params.offer_specialty);
    if (params?.want_specialty) searchParams.set('want_specialty', params.want_specialty);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    return fetchAPI<TradeOfferWithAgent[]>(`/barter/offers?${searchParams}`);
  },

  getOffer: (id: string) => fetchAPI<TradeOfferWithAgent>(`/barter/offers/${id}`),

  createOffer: (data: { agent_id: string; offer_specialty: AgentSpecialty; want_specialty: AgentSpecialty }) =>
    fetchAPI<TradeOfferWithAgent>('/barter/offers', { method: 'POST', body: JSON.stringify(data) }),

  cancelOffer: (id: string) =>
    fetchAPI<TradeOfferWithAgent>(`/barter/offers/${id}`, { method: 'DELETE' }),

  listTrades: (status?: TradeStatus) => {
    const searchParams = new URLSearchParams();
    if (status) searchParams.set('status', status);
    return fetchAPI<Trade[]>(`/barter/trades?${searchParams}`);
  },

  getTrade: (id: string) => fetchAPI<TradeWithDetails>(`/barter/trades/${id}`),

  getAgentTrades: (agentId: string, status?: TradeStatus) => {
    const searchParams = new URLSearchParams();
    if (status) searchParams.set('status', status);
    return fetchAPI<Trade[]>(`/barter/trades/agent/${agentId}?${searchParams}`);
  },
};

// Jobs API
export const jobsAPI = {
  list: (params?: { specialty?: AgentSpecialty; status?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.specialty) searchParams.set('specialty', params.specialty);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    return fetchAPI<unknown[]>(`/jobs?${searchParams}`);
  },
};
