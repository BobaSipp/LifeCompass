# LifeLedger — PRD

## Original Problem Statement
A personal "financial logger and life logger": entire life on one site — life span in weeks, daily logging (what I did right/wrong), workout logger via checkboxes, a calendar of boxes where a day only turns fully green if daily tasks are set before 9AM Dutch time AND completed. Track financial stats (start at 0), savings accounts with APY, income/expenses, and a Business Tracker. White, professional, non-distracting, simple, with a left sidebar. Owner-only editing; viewers read-only.

## Architecture
- Backend: FastAPI + MongoDB (motor), JWT (Bearer/localStorage) auth, single seeded admin (owner). All routes under /api.
- Frontend: React + Tailwind + shadcn/ui. Swiss/high-contrast white theme (Satoshi + JetBrains Mono). Left sidebar layout, react-router pages.

## User Personas
- Owner (Remco): full edit access after login.
- Viewer: public read-only access, no login.

## Core Requirements (static)
- Daily log with 9AM Dutch-time rule + full-green completion logic.
- Life-in-weeks visualization (birth 2003-08-28, 85y default).
- Finances: savings/APY, income/expenses, business ventures — all start at 0.
- Owner/viewer role separation.

## Implemented (2026-06)
- JWT owner auth + seeded admin, role-gated mutations, public GETs.
- Owner auth with profile photo (face crop) in sidebar.
- Dashboard, Daily Log (calendar + 9AM rule + task categories/comments + workout), Life in Weeks.
- Finances: savings/APY, income/expense, summary.
- Trading Desk: real crypto (CoinGecko) + simulated stocks/forex/indices, live-animated watchlist, custom symbols, full trade journal (P&L, win rate).
- Business Tracker extended: businesses + social accounts (platform/followers), status (active/paused/failed/sold) with fail reasons.
- Growth: log-and-chart metrics (gym lifts, net-worth snapshots, IQ, focus) with Recharts line charts.
- Mental: mood/energy/stress/sleep/meditation tracking + charts.
- Relationships: people, closeness, interaction logs. Books: 3-shelf tracker + progress/ratings.
- Tested end-to-end twice: iteration_1 16/16, iteration_2 33/33 backend + full frontend, 100% pass.

## Backlog
- P1: Trading — historical price sparklines/charts per symbol; real stock/forex feed via paid key.
- P2: Growth — cross-metric dashboard; auto net-worth snapshots on a schedule.
- P2: Daily — per-business task grouping view; streak notifications before the 9AM deadline.
- P2: Books — Open Library cover images; reading-goal target.
