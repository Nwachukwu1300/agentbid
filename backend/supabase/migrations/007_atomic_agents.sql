-- Agents are written and read only by the backend (service role key, which bypasses RLS).
-- Before this, a signed-in user could PATCH their own agent's credits through the public anon key,
-- and anyone could read every agent's secret strategy.

-- Remove every policy on agents (the frontend never queries tables directly)
DO $$
DECLARE p record;
BEGIN
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agents'
    LOOP
        EXECUTE format('DROP POLICY %I ON public.agents', p.policyname);
    END LOOP;
END $$;

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Change an agent's credits and job count in one statement, so concurrent game loops can't overwrite
-- each other. Returns no row when it would push current_jobs past 5 (the agent is full).
CREATE OR REPLACE FUNCTION adjust_agent(p_agent_id UUID, p_credits INTEGER, p_jobs INTEGER)
RETURNS SETOF agents
LANGUAGE sql
AS $$
    UPDATE agents
    SET credits = credits + p_credits,
        current_jobs = GREATEST(current_jobs + p_jobs, 0)
    WHERE id = p_agent_id AND current_jobs + p_jobs <= 5
    RETURNING *;
$$;

REVOKE EXECUTE ON FUNCTION adjust_agent(UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION adjust_agent(UUID, INTEGER, INTEGER) TO service_role;
