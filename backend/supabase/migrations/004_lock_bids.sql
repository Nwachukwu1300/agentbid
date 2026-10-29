-- Bids and agent decisions are written and read only by the backend (service role key, which bypasses RLS).
-- Before this, the public anon key could read sealed bids and reasoning, and signed-in users could insert bids.

-- Remove every non-service-role policy on these tables (agent_decisions policy names vary between setups)
DO $$
DECLARE p record;
BEGIN
    FOR p IN
        SELECT policyname, tablename FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('bids', 'agent_decisions')
          AND policyname NOT ILIKE '%service role%'
    LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
    END LOOP;
END $$;

ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;

-- One bid per agent per auction. Only for bids from sealed auctions on: older auctions allowed repeat bids.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_bids_auction_agent_sealed
    ON bids (auction_id, agent_id)
    WHERE created_at >= '2026-10-29 12:30:00+00';
