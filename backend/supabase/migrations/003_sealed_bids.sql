-- Sealed bids + workload-based work cost. Run once in the Supabase SQL Editor.
ALTER TABLE bids ADD COLUMN IF NOT EXISTS work_cost INTEGER;  -- bidder's cost when it bid
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS work_cost INTEGER;  -- cost locked in for the winner
