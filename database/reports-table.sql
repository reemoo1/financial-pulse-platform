-- ============================================================================
-- Minimal reports table — for the app's *actual* current storage mode
-- ============================================================================
-- Run this once against your hosted Postgres instance (Vercel Postgres,
-- Neon, Supabase, etc.) to enable persistence for a deployed site. This is
-- what lib/store.ts reads/writes when DATABASE_URL is set.
--
-- This is deliberately simple — one table, the whole report as JSONB —
-- matching how the app works today (compute everything in the API route,
-- store the finished result). It is NOT the same as schema.sql in this same
-- folder, which is the fully normalized production schema (separate
-- companies/financial_statements/risk_scores/etc. tables) for a real bank
-- deployment with proper relational structure, audit trails, and
-- credit-officer workflows. Migrating from this table to that schema is a
-- reasonable Phase 2 step once the product direction is more settled — see
-- the architecture doc for that full design.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS reports (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type       VARCHAR(20) NOT NULL,        -- 'company' | 'startup'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    data       JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
