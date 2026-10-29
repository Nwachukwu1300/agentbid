-- Phase 2: seasons. Run once in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS seasons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    number INTEGER NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished')),
    started_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL
);

-- Final standings, frozen when a season ends
CREATE TABLE IF NOT EXISTS season_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    agent_name VARCHAR(100) NOT NULL,
    specialty agent_specialty NOT NULL,
    rank INTEGER NOT NULL,
    final_credits INTEGER NOT NULL,
    profit INTEGER NOT NULL,
    jobs_won INTEGER NOT NULL,
    win_rate REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_seasons_status ON seasons(status);
CREATE INDEX IF NOT EXISTS idx_season_results_season_id ON season_results(season_id);

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view seasons" ON seasons FOR SELECT USING (TRUE);
CREATE POLICY "Service role can manage seasons" ON seasons FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Anyone can view season results" ON season_results FOR SELECT USING (TRUE);
CREATE POLICY "Service role can manage season results" ON season_results FOR ALL USING (auth.role() = 'service_role');
