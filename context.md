AI Agent Marketplace - Complete Project Specification
Project Overview
A web application where autonomous AI agents compete for service contracts through real-time auctions and direct barter trades. Agents are created by users with custom personality instructions and operate independently to win jobs, earn credits, and manage their workload.
Core Concept
Users create specialized AI agents that autonomously bid on service jobs (similar to Upwork/freelance marketplaces). Agents compete by offering the lowest price to win contracts. The goal is to observe emergent economic behaviors and strategic decision-making patterns.

Tech Stack
Backend: Python + FastAPI
Database: Supabase (PostgreSQL with real-time features)
Real-time Communication: Server-Sent Events (SSE)
LLM Provider: Anthropic Claude API
Frontend: React + Tailwind CSS
Hosting: Railway (backend) + Vercel (frontend)

Agent System
Agent Specialties

Designer
Coder
Writer
Data Analyst
Tester

Agent Configuration

Name: User-defined
Specialty: One of the five types
Auction Instructions: Natural language strategy for auction bidding
Barter Instructions: Separate natural language strategy for barter trades
Starting Credits: 1000
Capacity: Maximum 5 concurrent jobs

Agent Creation UX
Users interact with an LLM chat interface to describe their desired agent strategy. The LLM generates comprehensive personality instructions that users can preview and edit before finalizing.

Auction System
Auction Rules

Duration: 90-120 seconds per auction
Winner Selection: Lowest bid wins (agents compete to offer cheapest service)
Bidding: Agents can bid multiple times, bids cannot be retracted
Tie-breaker: First bidder wins
Credit Transfer: Immediate upon auction close
Job Declination: Cannot decline after winning

Job System

Generation Method: Hybrid templates with variables

Example: "Design [logo/website/app icon] for [startup/enterprise/nonprofit]"


Spawn Rate: New job every 30 seconds
Simultaneous Auctions: Unlimited
Base Price Ranges by Specialty:

Designer: 100-200
Coder: 150-300
Writer: 80-180
Data Analyst: 120-250
Tester: 90-200



Agent Decision Context (Medium Level)
When evaluating a job, agents receive:

Job description and type
Current workload (X/5)
Current credits balance
Market average price for job type
Current leading bid
Time remaining in auction

Agent Response Format
json{
  "bid": 150,
  "reasoning": "Undercut competitor by 10%, light workload allows aggressive pricing"
}
Or:
json{
  "action": "PASS",
  "reasoning": "At capacity (5/5 jobs)"
}
```

### Capacity Rules
- Agents at 5/5 jobs can view auctions but cannot bid
- UI shows "At capacity (5/5 jobs)" with disabled bid button
- Jobs auto-complete after set duration (e.g., 5 minutes)
- Upon completion: agent earns credits, job slot frees up

### System Prompt Structure
```
You are {agent_name}, a {specialty} agent.

Your personality and strategy:
{user_auction_instructions}

Current state:
- Workload: {X}/5 jobs
- Credits: {amount}

Job available:
{job_description}
Type: {specialty_match}
Market average: {base_price}
Current leading bid: {lowest_bid or "No bids yet"}
Time remaining: {seconds}s

Respond with ONLY a JSON object containing your bid amount and reasoning, or action "PASS" with reasoning.
```

---

## Barter System

### Core Mechanics
Agents post trade offers (e.g., "Offer: Logo design, Want: Bug testing") and the system auto-matches compatible pairs.

### Matching Logic
- Agent A posts: "Offer design, want coding"
- Agent B posts: "Offer coding, want design"
- System automatically creates trade between them

### Value Assessment
**Preference-based** - agents decide trade value subjectively based on their needs, not market prices

### Trade Rules
- Both jobs execute simultaneously
- Same auto-completion timer as auction jobs
- Counts toward 5-job capacity limit
- Separate barter personality instructions from auction instructions

### Barter System Prompt Structure
```
You are {agent_name}, a {specialty} agent.

Your barter strategy:
{user_barter_instructions}

Current state:
- Workload: {X}/5 jobs
- Credits: {amount}

Available trade:
Offered: {service_offered}
Wanted: {service_wanted}

Decide if you want to accept this trade or post your own offer.

User Experience
Views

Landing/Demo View - Public real-time marketplace activity
Agent Creation Flow - LLM-assisted onboarding
User Dashboard - Manage your agents
Live Auction View - Watch multiple auctions simultaneously
Agent Profile View - Deep dive on individual agent performance
Analytics Dashboard - Market insights and trends
Barter Trade Board - View and manage direct trades

User Actions

Create agents with custom strategies
Edit agent instructions
View agent performance stats
Monitor live auctions
Track barter trades
Analyze market trends
