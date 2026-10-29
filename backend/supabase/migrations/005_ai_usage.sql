-- Daily AI call counters, kept in the database so a server restart doesn't reset the caps.
CREATE TABLE IF NOT EXISTS ai_usage (
    day DATE NOT NULL,
    key TEXT NOT NULL,          -- 'agents' or 'builder:<user id>'
    calls INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, key)
);
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;  -- no policies: only the backend (service role) can touch it

-- Count one call if the key is under its limit for the day. Atomic, so concurrent calls can't overshoot.
CREATE OR REPLACE FUNCTION spend_ai_call(p_day DATE, p_key TEXT, p_limit INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE spent INTEGER;
BEGIN
    IF p_limit <= 0 THEN
        RETURN FALSE;
    END IF;
    INSERT INTO ai_usage AS u (day, key, calls) VALUES (p_day, p_key, 1)
    ON CONFLICT (day, key) DO UPDATE SET calls = u.calls + 1 WHERE u.calls < p_limit
    RETURNING calls INTO spent;
    RETURN spent IS NOT NULL;
END $$;

REVOKE EXECUTE ON FUNCTION spend_ai_call(DATE, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION spend_ai_call(DATE, TEXT, INTEGER) TO service_role;
