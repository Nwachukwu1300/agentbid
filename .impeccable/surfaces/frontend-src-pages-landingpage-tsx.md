---
version: 1
slug: "frontend-src-pages-landingpage-tsx"
primary_target: "frontend/src/pages/LandingPage.tsx"
related_targets: ["frontend/src/pages/LiveAuctionsPage.tsx","frontend/src/pages/AuctionDetailPage.tsx","frontend/src/pages/AnalyticsPage.tsx","frontend/src/pages/AgentProfilePage.tsx","frontend/src/pages/DashboardPage.tsx","frontend/src/pages/CreateAgentPage.tsx","frontend/src/pages/AuthPage.tsx"]
---

## Scope

Landing page (Persuade), built first. The same world then reaches every app screen (Operate) in the same pass, because Lord Soma chose a whole-app rollout.

- **Audience:** recruiters and interviewers judging a portfolio piece in about 3 minutes, on a laptop in daylight. Players are secondary.
- **Primary action:** "Watch the live arena" (`/auctions`). Secondary: "Sign up and build an agent".
- **Proof:**
  - the latest real finished round (bids, winner, second price, the won/lost explanations, and its negotiation transcript when there was one);
  - live arena numbers, in credits and never "$";
  - three build-log decisions with numbers, plus a link to `docs/BUILD_LOG.md` on GitHub (public repo).
- **States:**
  - **Empty arena:** show a clearly labelled sample round.
  - **Stats failed:** no "live" claim.
  - **Ranges:** 1-5 bidders, and a negotiation in about 30% of rounds.

## Direction contract

THESIS: AgentBid is a strategy board game whose players are AI agents. Every screen is the game's box, board and rulebook, so the landing page proves a real round rather than listing features. It refuses the dark AI-product hero: no gradient headline, no grid of feature cards.

OWN-WORLD:
- **Ground:** a pale sage printed board (#E7EDE6) carrying white card-stock pieces, outlined in ink (#18201B).
- **Landing lid only:** a bottle-green box lid (#14402F) with a gold-foil title (#F0B93A).
- **Player colours:** the five specialties are wooden player colours shown as token discs: coder blue, designer purple, writer red, data-analyst yellow, tester green.
- **Rulebook grammar:** numbered rules, "Example" boxes and a round track.
- **Type:** Archivo, set wide and heavy for titles and normal width for text, with tabular numbers everywhere.

STORY:
1. The visitor sees the box and reads the one-line rules.
2. They step through one real round as a rulebook example: sealed bids, the reveal, the second price, the client's call, the score.
3. They see the season standings.
4. They read three decisions backed by numbers.
5. They enter the live arena.

FIRST VIEWPORT:
- **Left, about 55%: the green box lid.**
  - "AgentBid" set wide and heavy in gold.
  - The hook as its tagline.
  - A box-side strip with live facts: the agents playing now, 60-minute seasons, the same AI model for everyone.
  - The gold "Watch the live arena" button and an outlined "Sign up and build an agent".
- **Right, about 45%: a card-stock "How to play" rule card,** with four numbered steps, each marked by a token.
- **Below the fold:** the worked example begins.

FORM: The Rulebook, a strategy board game. It was the top candidate on my grounded list, and the user chose it as Impeccable's pick. seed:58c1ffbf9d3084b4.
- **Signature interaction:** the worked example of the latest real round, stepped through with Previous and Next buttons or the keyboard. Player tokens and a price marker move to the winner as it plays.
- **Motion grammar:** tokens slide and settle with an exponential ease-out. Under reduced motion, only the end states show.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
