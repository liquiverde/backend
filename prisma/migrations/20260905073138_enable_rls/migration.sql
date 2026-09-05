-- Supabase automatically exposes every table in the `public` schema through
-- its own PostgREST-based REST API (callable with the project's `anon`/
-- `authenticated` API keys), independently of this NestJS backend and its
-- own auth/authorization logic. Without Row Level Security, that exposure
-- is wide open: anyone with the project's anon key could read/write these
-- tables directly, completely bypassing JwtAuthGuard/ListOwnershipGuard/etc.
--
-- This app never queries Postgres as `anon`/`authenticated` — it always
-- connects as the `postgres` role (see DATABASE_URL), which has BYPASSRLS
-- (confirmed via `SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user`).
-- Enabling RLS with no policies therefore has ZERO effect on this app's own
-- queries (the bypassing role ignores RLS entirely), while making every
-- table default-deny for any role that does not bypass RLS -- exactly the
-- `anon`/`authenticated` roles Supabase's auto-API uses. No per-table
-- policies are added on purpose: nothing is meant to reach these tables
-- except through this backend's own authorization logic.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sustainability_scores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "price_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shopping_lists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "list_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reward_events" ENABLE ROW LEVEL SECURITY;

-- Prisma's own migration-history table lives in the same schema. It holds
-- no user data, but there's no reason to leave it in the exposed set either.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
