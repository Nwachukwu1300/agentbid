import type { AgentSpecialty, AuctionBreakdown } from '@/types';

export interface RoundBid {
  name: string;
  specialty: AgentSpecialty;
  bid: number;
  cost: number;
  explanation: string;
  won: boolean;
}

export interface Round {
  id: string | null; // null for the sample round
  jobTitle: string;
  specialty: AgentSpecialty;
  budget: number;
  bids: RoundBid[]; // lowest first
  pricePaid: number;
  closedAt: string | null;
  call: null | {
    lines: { speaker: 'client' | 'agent'; text: string; move: string }[];
    outcome: string;
    reveal: string;
  };
}

/** The round the page teaches with, built from a real auction breakdown. */
export function roundFromBreakdown(b: AuctionBreakdown): Round | null {
  const bids = b.agents
    .filter((a) => a.best_bid !== null && a.work_cost !== null && a.specialty)
    .sort((x, y) => (x.best_bid as number) - (y.best_bid as number))
    .map((a) => ({
      name: a.agent_name,
      specialty: a.specialty as AgentSpecialty,
      bid: a.best_bid as number,
      cost: a.work_cost as number,
      explanation: a.explanation,
      won: a.outcome === 'won',
    }));
  const winner = bids.find((x) => x.won);
  if (!winner) return null;
  const n = b.negotiation;
  return {
    id: b.auction.id,
    jobTitle: b.auction.job_title,
    specialty: b.auction.job_specialty,
    budget: b.auction.job_base_price,
    bids,
    pricePaid: b.auction.price_paid ?? winner.bid,
    closedAt: b.auction.closed_at,
    call: n && n.status !== 'active'
      ? {
          lines: n.messages.slice(0, 4).map((m) => ({
            speaker: m.speaker,
            text: m.message,
            move: m.action === 'accept' ? `accepts ${m.offer}` : m.action === 'walk_away' ? 'walks away' : `offers ${m.offer}`,
          })),
          outcome: n.status === 'deal' ? `Deal at ${n.final_price}.` : 'No deal: the job goes unfilled.',
          reveal: `${n.explanation ?? ''} The client was ${n.client_personality}, with a secret limit of ${n.client_max_price}.`.trim(),
        }
      : null,
  };
}

/** Shown, and labelled, only while the arena has no finished round yet. Agents A-C are not real players. */
export const SAMPLE_ROUND: Round = {
  id: null,
  jobTitle: 'Design a checkout flow for a bike shop',
  specialty: 'designer',
  budget: 200,
  bids: [
    { name: 'Agent A', specialty: 'designer', bid: 110, cost: 92, explanation: 'Won with a bid of 110 and was paid 140, the runner-up’s bid.', won: true },
    { name: 'Agent B', specialty: 'designer', bid: 140, cost: 104, explanation: 'Lost: bid 140, 30 above the winner.', won: false },
    { name: 'Agent C', specialty: 'designer', bid: 175, cost: 118, explanation: 'Lost: bid high to protect its margin.', won: false },
  ],
  pricePaid: 140,
  closedAt: null,
  call: null,
};
