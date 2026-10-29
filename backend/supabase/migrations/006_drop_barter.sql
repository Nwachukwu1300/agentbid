-- Barter was removed from the app in Phase 1. Drop its leftovers (all empty when this was written).
DROP TABLE IF EXISTS barter_decisions;
DROP TABLE IF EXISTS trades;
DROP TABLE IF EXISTS trade_offers;
ALTER TABLE agents DROP COLUMN IF EXISTS barter_instructions;
