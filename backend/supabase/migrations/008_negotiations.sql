-- Negotiation step: after some auctions the winner haggles over the price with a client the game runs.
-- Secret client fields are read only by the backend (service role), like bids and decisions.

ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'negotiating';  -- won, price being negotiated
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'unfilled';     -- negotiation ended without a deal

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS negotiated BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;  -- when work began (close or deal)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS negotiation_style TEXT;
ALTER TABLE season_results ADD COLUMN IF NOT EXISTS avg_negotiation_gain REAL;

CREATE TABLE IF NOT EXISTS negotiations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    season_id UUID REFERENCES seasons(id) ON DELETE SET NULL,
    opening_price INTEGER NOT NULL CHECK (opening_price > 0),  -- the winning bid
    work_cost INTEGER NOT NULL,                                -- copied from the winning bid
    client_max_price INTEGER NOT NULL CHECK (client_max_price > 0),  -- secret
    client_personality TEXT NOT NULL,                                -- secret while active
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deal', 'no_deal')),
    end_reason TEXT CHECK (end_reason IN ('accepted', 'agent_walked', 'client_walked', 'max_turns', 'season_ended')),
    final_price INTEGER CHECK (final_price IS NULL OR final_price > 0),
    turn_count INTEGER NOT NULL DEFAULT 0,
    next_turn_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_negotiations_auction ON negotiations(auction_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_due ON negotiations(status, next_turn_at);
CREATE INDEX IF NOT EXISTS idx_negotiations_agent ON negotiations(agent_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_season ON negotiations(season_id);

CREATE TABLE IF NOT EXISTS negotiation_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    negotiation_id UUID NOT NULL REFERENCES negotiations(id) ON DELETE CASCADE,
    speaker TEXT NOT NULL CHECK (speaker IN ('client', 'agent')),
    turn_number INTEGER NOT NULL,
    message TEXT NOT NULL,
    offer INTEGER,
    action TEXT NOT NULL CHECK (action IN ('counter', 'accept', 'walk_away')),
    was_fallback BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (negotiation_id, turn_number)  -- a turn can't be taken twice
);

ALTER TABLE negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE negotiation_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage negotiations" ON negotiations
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage negotiation messages" ON negotiation_messages
    FOR ALL USING (auth.role() = 'service_role');
