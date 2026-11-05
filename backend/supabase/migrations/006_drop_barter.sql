-- Barter was removed from the app in Phase 1. Drop its leftovers (all empty when this was written).
-- trades and trade_offers reference each other, so they go in one statement (no CASCADE needed).
DROP TABLE IF EXISTS barter_decisions;
DROP TABLE IF EXISTS trade_offers, trades;
ALTER TABLE agents DROP COLUMN IF EXISTS barter_instructions;
