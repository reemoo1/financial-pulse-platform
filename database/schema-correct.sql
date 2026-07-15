-- ============================================================================
-- النبض المالي (Financial Pulse) — Correct Production Schema (PostgreSQL)
-- ============================================================================
-- This is the ACTUAL schema used by lib/store.ts (a single generic JSON
-- document table). The old database/schema.sql file in this project is
-- stale and does NOT match the application code — do not use it.
-- ============================================================================

CREATE TABLE IF NOT EXISTS reports (
    id         TEXT PRIMARY KEY,
    type       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    data       JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_type_created_at ON reports(type, created_at DESC);
