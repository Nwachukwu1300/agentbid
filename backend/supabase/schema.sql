-- AgentBid Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE agent_specialty AS ENUM ('designer', 'coder', 'writer', 'data_analyst', 'tester');
CREATE TYPE job_status AS ENUM ('pending', 'in_auction', 'assigned', 'in_progress', 'completed');

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    specialty agent_specialty NOT NULL,
    auction_instructions TEXT NOT NULL,
    barter_instructions TEXT NOT NULL,
    credits INTEGER NOT NULL DEFAULT 1000,
    current_jobs INTEGER NOT NULL DEFAULT 0 CHECK (current_jobs >= 0 AND current_jobs <= 5),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    specialty agent_specialty NOT NULL,
    base_price INTEGER NOT NULL CHECK (base_price > 0),
    status job_status NOT NULL DEFAULT 'pending',
    assigned_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    winning_bid INTEGER CHECK (winning_bid IS NULL OR winning_bid > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_specialty ON agents(specialty);
CREATE INDEX IF NOT EXISTS idx_agents_is_active ON agents(is_active);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_specialty ON jobs(specialty);
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_agent ON jobs(assigned_agent_id);

-- Row Level Security (RLS) policies

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- Agents policies
CREATE POLICY "Anyone can view active agents"
    ON agents FOR SELECT
    USING (is_active = TRUE);

CREATE POLICY "Users can view own agents"
    ON agents FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own agents"
    ON agents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agents"
    ON agents FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own agents"
    ON agents FOR DELETE
    USING (auth.uid() = user_id);

-- Jobs policies
CREATE POLICY "Anyone can view jobs"
    ON jobs FOR SELECT
    USING (TRUE);

CREATE POLICY "Service role can manage jobs"
    ON jobs FOR ALL
    USING (auth.role() = 'service_role');

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, created_at, updated_at)
    VALUES (NEW.id, NEW.email, NOW(), NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- STAGE 2: Auction System Tables
-- =============================================

-- Auction status enum
CREATE TYPE auction_status AS ENUM ('active', 'closed', 'cancelled');

-- Auctions table
CREATE TABLE IF NOT EXISTS auctions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 90 AND duration_seconds <= 120),
    status auction_status NOT NULL DEFAULT 'active',
    winning_bid_id UUID,  -- Will reference bids table
    winning_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    winning_amount INTEGER CHECK (winning_amount IS NULL OR winning_amount > 0),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ
);

-- Bids table
CREATE TABLE IF NOT EXISTS bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_winning BOOLEAN NOT NULL DEFAULT FALSE
);

-- Add foreign key for winning_bid_id after bids table exists
ALTER TABLE auctions
    ADD CONSTRAINT fk_winning_bid
    FOREIGN KEY (winning_bid_id) REFERENCES bids(id) ON DELETE SET NULL;

-- Indexes for auction performance
CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
CREATE INDEX IF NOT EXISTS idx_auctions_job_id ON auctions(job_id);
CREATE INDEX IF NOT EXISTS idx_auctions_ends_at ON auctions(ends_at);
CREATE INDEX IF NOT EXISTS idx_auctions_winning_agent ON auctions(winning_agent_id);

-- Indexes for bids performance
CREATE INDEX IF NOT EXISTS idx_bids_auction_id ON bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_bids_agent_id ON bids(agent_id);
CREATE INDEX IF NOT EXISTS idx_bids_amount ON bids(amount);
CREATE INDEX IF NOT EXISTS idx_bids_created_at ON bids(created_at);

-- Composite index for finding winning bid (lowest amount, earliest time)
CREATE INDEX IF NOT EXISTS idx_bids_auction_amount_time ON bids(auction_id, amount, created_at);

-- Enable RLS on new tables
ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- Auctions policies (anyone can view, service role manages)
CREATE POLICY "Anyone can view auctions"
    ON auctions FOR SELECT
    USING (TRUE);

CREATE POLICY "Service role can manage auctions"
    ON auctions FOR ALL
    USING (auth.role() = 'service_role');

-- Bids policies
CREATE POLICY "Anyone can view bids"
    ON bids FOR SELECT
    USING (TRUE);

CREATE POLICY "Agents can place bids"
    ON bids FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM agents
            WHERE agents.id = agent_id
            AND agents.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage bids"
    ON bids FOR ALL
    USING (auth.role() = 'service_role');
