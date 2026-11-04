---
target: frontend/src/pages/LandingPage.tsx
total_score: 15
max_score: 36
na_heuristics: 7
p0_count: 1
p1_count: 3
target_identity: "file:/Users/mmesoma/Developer/aimarketplace/frontend/src/pages/LandingPage.tsx"
target_fingerprint: "sha256:8535af30695b67367eba3d4eaa9548fb7ab8f891c73c7dc600a8517dfff0b63b"
target_path: /Users/mmesoma/Developer/aimarketplace/frontend/src/pages/LandingPage.tsx
timestamp: 2026-11-03T21-13-44Z
slug: frontend-src-pages-landingpage-tsx
---
Method: dual-agent (A: design review, B: detector + browser evidence; run sequentially because they share one browser)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Stats load once, never refresh; badge showed 2 live auctions while /auctions showed 4; "Live" badge pulses even if stats fail |
| 2 | Match System / Real World | 1 | Generic software-product language ("Deploy", "fleet", "Total Volume") instead of the game's words |
| 3 | User Control and Freedom | 2 | Primary "Launch App" silently lands on a "Welcome back" login form |
| 4 | Consistency and Standards | 2 | Three labels for the same sign-in wall; "Live Auctions" link in nav vs dead card below |
| 5 | Error Prevention | 2 | No warning that Launch App / Dashboard need an account; footer links are href="#" |
| 6 | Recognition Rather Than Recall | 2 | Decorative icons; nothing shows what an auction or strategy looks like |
| 7 | Flexibility and Efficiency | n/a | Single-path landing page |
| 8 | Aesthetic and Minimalist Design | 2 | Clean but padded: generic 4-card feature grid; closing band as heavy as the hero |
| 9 | Error Recovery | 1 | Failed stats show "—" with no explanation under a pulsing Live badge |
| 10 | Help and Documentation | 1 | "Docs" is href="#" though docs/BUILD_LOG.md exists |
| **Total** | | **15/36** | **Poor (42%)** |

## Design Specificity Verdict
Category-interchangeable: gradient headline, pulsing live badge, centered hero + 4 icon stat cards, "Everything you need to win" icon feature grid, "Ready to deploy" band, dead footer links. Missing every distinctive mechanic (plain-English strategies, sealed second-price auctions, client negotiation with secret limit and personality, hourly seasons, explained results, same model/rules in code). The PRODUCT.md hook is absent.
Deterministic scan: CLI on LandingPage.tsx clean (0). Browser overlay: 15 findings desktop, 17 mobile: low-contrast white on #8b5cf6 4.2:1 (btn-primary x3 lines 84,126,205 + logo line 67, borderline); muted #6b7280 on #151b2b 3.6:1 (stat labels line 149); footer #6b7280 on #0b0f1a 4.0:1 (line 221); gradient-text (line 116); icon-tile-stack x4 (lines 174-177); overused-font Inter (tailwind.config.js:49); mobile: unbalanced-heading (line 161), straggler (line 203). False positive dropped: text-occlusion (overlay detecting its own label).

## Priority Issues
- [P0] Hero copy breaks the honesty rule: "bid on real jobs... and earn—24/7, without you lifting a finger" (lines 119-120); "Total Volume" shows "$37.1K" because formatCredits (src/lib/utils.ts) prefixes "$" (also "Budget: $168" on /auctions). Fix: rewrite subhead from the hook; show credits without "$" everywhere. Command: clarify.
- [P1] The page never shows the game working. Fix: replace feature grid with a "how a round works" sequence (strategy -> sealed second-price bid -> negotiation with client personality -> season leaderboard) backed by one real result from the API. Command: shape, then bolder.
- [P1] Primary CTA serves the wrong audience: solid "Launch App" (x2) leads to login; "Watch Live Auctions" is secondary; "Create Your Agent" needs sign-in. Fix: primary "Watch the live arena"; secondary "Sign up and build an agent"; nav button "Sign in". Command: clarify, layout.
- [P1] The builder's thinking is missing: no link to docs/BUILD_LOG.md; Terms/Privacy/Docs are href="#". Fix: short "How it was built" section with 2-3 evidence-backed decisions (season 27 73% deal rate; stubborn 0 vs fair 19.4 per negotiation), link Docs to the build log, remove Terms/Privacy. Command: shape.
- [P2] Status honesty and contrast: Live badge pulses on failure, stats never refresh; btn-primary 4.2:1; muted labels 3.6:1; footer 4.0:1. Fix: badge only when stats loaded, refresh from live feed; darken accent purple (tailwind.config.js:20), lighten muted (tailwind.config.js:40). Command: audit, then polish.

## Persona Red Flags
- Morgan (recruiter, 3 minutes): sees template hero, files it as boilerplate; never sees auction rules, a negotiation, a real result, or the decisions.
- Jordan (first-timer): can't say what they'd do; "your agent learns your style" is vague and untrue; "Launch App" lands on "Welcome back" login.
- Riley (promises vs reality): "real jobs", "earn", "24/7" vs made-up jobs, game credits, daily AI cap; "Join 10 active agents" frames house agents as a community; stale badge count; "—" stats under pulsing Live badge.
- Casey (phone): nav links hidden with no menu button (Analytics unreachable); headline wraps to 4 lines leaving "Win" alone; stats below the fold; long low-value card scroll; ~20px footer tap targets.

## Minor Observations
Hover-only feature cards aren't links; Sparkles icon reused meaninglessly; page title "AgentBid - AI Agent Marketplace"; no <main> or meta description; animate-ping without motion-reduce; "entire fleet" oversells a 3-agent cap; card-in-card closing band; inconsistent dash spacing.

## Questions to Consider
- If the live auctions page is the best proof, why isn't the landing page a framed live auction with a paragraph of rules?
- What would the page say if written for someone deciding whether to hire the builder?
- What sentence could only AgentBid say ("Same model, same jobs. Only your strategy differs.")?
