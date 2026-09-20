# Jade & Co. — Jade Dynasty (Web App) — PRD

## Original Problem Statement
Convert the "Jade & Co." (Jade Dynasty) Expo mobile app into a full website. The app is a membership/subscription platform where members join the "Jade Dynasty" and choose a "tribute" (amount + rhythm/frequency + payment method), can send one-time tributes, log in/sign up, with a member dashboard and an admin dashboard.

## User Choices
- Payments: PayPal (Sandbox credentials provided by user)
- Auth: Email+password (JWT) with separate admin login, PLUS Google (Emergent-managed) — unified into one JWT cookie session
- Scope: Everything (member signup/login, tribute flow, one-time tribute, member dashboard, admin dashboard)
- Branding: Keep the mobile app's pink "Jade Dynasty" aesthetic and copy
- Admin dashboard: members list, tribute/payment history, totals/stats

## Architecture
- Backend: FastAPI (`/app/backend/server.py`), MongoDB (motor). JWT (PyJWT) httpOnly cookie auth + bcrypt. PayPal REST via httpx (OAuth token, Orders v2 for one-time, Billing Plans/Subscriptions v1 for recurring). Admin seeded on startup.
- Frontend: React 19 + React Router, Tailwind (Playfair Display + Outfit), framer-motion, shadcn/ui, @paypal/react-paypal-js. AuthContext (null/false/object states).

## Personas
- Patron/Member: joins the Dynasty, gives one-time or recurring tributes, tracks contributions.
- Admin: oversees members, tributes, and revenue.

## Core Requirements (static)
- Landing hero matching mobile branding; signup/login (email+password + Google); admin login.
- Tribute flow: amount → rhythm → PayPal payment (order for one-time, subscription for recurring).
- Public one-time tribute (guest allowed).
- Member dashboard: active membership, total given, tribute history.
- Admin dashboard: stats, members table, tributes table; RBAC enforced.

## Implemented (2026-09-20)
- Full JWT auth (register/login/logout/me) + Emergent Google OAuth unified to JWT cookie; admin seeding + RBAC.
- PayPal Sandbox: create-order, capture-order, create-plan (cached product/plan), record-subscription. Verified live sandbox order + plan creation.
- Tribute flow (amount/rhythm/payment) with PayPal buttons; public one-time guest flow.
- Member dashboard (bento) + admin dashboard (stats + members/tributes tabs).
- Pink dynasty branding, responsive, animated. Tested: backend 18/18, frontend E2E 100%.

## Backlog / Remaining
- P1: Complete real PayPal buyer approval E2E (needs sandbox buyer account); webhook to sync subscription lifecycle (cancel/renew).
- P1: Member ability to cancel/pause a recurring tribute from dashboard.
- P2: Email receipts (Resend), tribute leaderboard, member tiers/perks.
- P2: Split backend into routers; PayPal SDK load-failure fallback UI.

## Next Tasks
- Add subscription cancel from member dashboard + PayPal webhook listener.
- Optional: switch PayPal to Live credentials when going to production.
