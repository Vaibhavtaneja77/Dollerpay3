# TetherPayout

Production-oriented USDT to INR payout platform built with Next.js App Router, Supabase Auth/Postgres/RLS, Tailwind CSS, Zod validation, and Decimal-safe financial calculations.

## Setup

1. Copy `.env.example` to `.env.local` and fill Supabase values.
2. Apply `supabase/migrations/202608090001_initial_schema.sql` to your Supabase project.
3. Install dependencies with `npm install`.
4. Run locally with `npm run dev`.

## Security Notes

- API route handlers require server-side auth and role checks.
- Request bodies are validated with Zod before mutation.
- Database writes use Supabase query builders or parameterized RPC functions, not interpolated SQL.
- Order creation, balance locking, completion, rejection, ledger writes, status history, and audit logs are atomic Postgres functions.
- RLS is enabled across user, wallet, payment, order, proof, settings, and audit tables.
- Bank account numbers are masked in order snapshots and UI.
- Blockchain verification is isolated behind `BlockchainProvider`; the app does not fake on-chain confirmations.

## Important Operational Steps

- Create at least one admin by updating the intended profile role to `admin` directly in Supabase SQL.
- For Google OAuth admin login, replace `admin@example.com` in `supabase/migrations/202608090002_admin_email_allowlist.sql` with your real admin email before applying, or insert it later:
  `insert into admin_email_allowlist(email) values ('you@example.com') on conflict do nothing; select sync_admin_profiles_from_allowlist();`
- Configure `platform_settings.admin_wallet_address` before accepting orders.
- Store payment proof files in a private Supabase Storage bucket and save the private object path when completing orders.
