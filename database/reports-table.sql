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
    type       VARCHAR(20) NOT NULL,        -- app record type (company, startup, users, files, etc.)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    data       JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);

-- Prevent duplicate identities even when two registration/bootstrap requests
-- arrive at the same time. These are partial indexes because all record types
-- share the same JSONB table in the current persistence model.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reports_bank_user_email
    ON reports ((lower(data->>'email')))
    WHERE type = 'bank_user';

CREATE UNIQUE INDEX IF NOT EXISTS uq_reports_company_user_cr
    ON reports ((data->>'crNumber'))
    WHERE type = 'company_user';

CREATE UNIQUE INDEX IF NOT EXISTS uq_reports_company_user_email
    ON reports ((lower(data->>'email')))
    WHERE type = 'company_user' AND COALESCE(data->>'email', '') <> '';

CREATE INDEX IF NOT EXISTS idx_reports_record_type
    ON reports(type);
