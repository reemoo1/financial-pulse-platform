-- ============================================================================
-- رُؤْية (Ruya) — Production Database Schema (PostgreSQL)
-- ============================================================================
-- Run with:  psql -U postgres -d ruya -f database/schema.sql
--
-- This schema matches the architecture used by the Next.js app's API routes.
-- The demo app (lib/store.ts) persists to a local JSON file out of the box;
-- to switch to this real schema, point DATABASE_URL at a Postgres instance
-- and swap lib/store.ts for `pg` queries (a reference snippet is included
-- at the bottom of lib/store.ts).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- users
-- ----------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('bank_admin', 'credit_officer', 'founder', 'investor', 'super_admin');

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'founder',
    organization_id UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- companies
-- ----------------------------------------------------------------------------
CREATE TABLE companies (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    legal_name                  VARCHAR(255) NOT NULL,
    commercial_registration_no  VARCHAR(50),
    sector                      VARCHAR(120) NOT NULL,
    city                        VARCHAR(120),
    founded_year                INT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_companies_user_id ON companies(user_id);
CREATE INDEX idx_companies_sector ON companies(sector);

-- ----------------------------------------------------------------------------
-- startup_projects
-- ----------------------------------------------------------------------------
CREATE TABLE startup_projects (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_name      VARCHAR(255) NOT NULL,
    idea_description  TEXT,
    sector            VARCHAR(120) NOT NULL,
    city              VARCHAR(120),
    current_capital   NUMERIC(14, 2) DEFAULT 0,
    expected_budget   NUMERIC(14, 2) DEFAULT 0,
    employee_count    INT DEFAULT 0,
    goals             TEXT,
    revenue_sources   TEXT,
    expenses          TEXT,
    target_audience   TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_startup_projects_user_id ON startup_projects(user_id);

-- ----------------------------------------------------------------------------
-- financial_statements
-- ----------------------------------------------------------------------------
CREATE TYPE statement_type AS ENUM ('balance_sheet', 'income_statement', 'cash_flow');

CREATE TABLE financial_statements (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    period_start        DATE,
    period_end          DATE,
    statement_type      statement_type NOT NULL,
    source_file_url     VARCHAR(500),
    raw_extracted_json  JSONB,
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_statements_company_id ON financial_statements(company_id);

-- ----------------------------------------------------------------------------
-- financial_ratios
-- ----------------------------------------------------------------------------
CREATE TABLE financial_ratios (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    statement_id    UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
    liquidity_ratio NUMERIC(8, 4),
    debt_ratio      NUMERIC(8, 4),
    profit_margin   NUMERIC(8, 4),
    cash_flow       NUMERIC(14, 2),
    z_score         NUMERIC(8, 4),
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_ratios_statement_id ON financial_ratios(statement_id);

-- ----------------------------------------------------------------------------
-- risk_scores
-- ----------------------------------------------------------------------------
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high');

CREATE TABLE risk_scores (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id          UUID REFERENCES companies(id) ON DELETE CASCADE,
    startup_project_id  UUID REFERENCES startup_projects(id) ON DELETE CASCADE,
    default_probability NUMERIC(5, 2) NOT NULL,
    risk_level          risk_level NOT NULL,
    model_version       VARCHAR(50) NOT NULL DEFAULT 'v1.0',
    computed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_risk_scores_target CHECK (
        (company_id IS NOT NULL AND startup_project_id IS NULL) OR
        (company_id IS NULL AND startup_project_id IS NOT NULL)
    )
);

CREATE INDEX idx_risk_scores_company_id ON risk_scores(company_id);
CREATE INDEX idx_risk_scores_startup_project_id ON risk_scores(startup_project_id);

-- ----------------------------------------------------------------------------
-- vision2030_scores
-- ----------------------------------------------------------------------------
CREATE TABLE vision2030_scores (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id          UUID REFERENCES companies(id) ON DELETE CASCADE,
    startup_project_id  UUID REFERENCES startup_projects(id) ON DELETE CASCADE,
    alignment_score     NUMERIC(5, 2) NOT NULL,
    pillar_breakdown    JSONB,
    computed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_vision_scores_target CHECK (
        (company_id IS NOT NULL AND startup_project_id IS NULL) OR
        (company_id IS NULL AND startup_project_id IS NOT NULL)
    )
);

CREATE INDEX idx_vision2030_scores_company_id ON vision2030_scores(company_id);
CREATE INDEX idx_vision2030_scores_startup_project_id ON vision2030_scores(startup_project_id);

-- ----------------------------------------------------------------------------
-- reports
-- ----------------------------------------------------------------------------
CREATE TABLE reports (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id          UUID REFERENCES companies(id) ON DELETE CASCADE,
    startup_project_id  UUID REFERENCES startup_projects(id) ON DELETE CASCADE,
    ai_summary_text     TEXT,
    swot_json           JSONB,
    pdf_url             VARCHAR(500),
    xlsx_url            VARCHAR(500),
    generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_reports_target CHECK (
        (company_id IS NOT NULL AND startup_project_id IS NULL) OR
        (company_id IS NULL AND startup_project_id IS NOT NULL)
    )
);

CREATE INDEX idx_reports_company_id ON reports(company_id);
CREATE INDEX idx_reports_startup_project_id ON reports(startup_project_id);

-- ----------------------------------------------------------------------------
-- funding_decisions
-- ----------------------------------------------------------------------------
CREATE TYPE funding_status AS ENUM ('ai_suggested', 'approved', 'rejected', 'modified');

CREATE TABLE funding_decisions (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id                   UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    recommended_funding         NUMERIC(14, 2),
    recommended_interest_rate   NUMERIC(5, 2),
    recommendation_text         TEXT,
    decided_by                  UUID REFERENCES users(id),
    status                      funding_status NOT NULL DEFAULT 'ai_suggested',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_funding_decisions_report_id ON funding_decisions(report_id);

-- ----------------------------------------------------------------------------
-- audit_logs
-- ----------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID REFERENCES users(id),
    action       VARCHAR(120) NOT NULL,
    entity_type  VARCHAR(80),
    entity_id    UUID,
    metadata     JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ============================================================================
-- Seed data (optional — useful for local development)
-- ============================================================================

INSERT INTO users (email, password_hash, full_name, role)
VALUES ('admin@ruya.sa', '$2b$10$replace_with_real_bcrypt_hash', 'مدير النظام', 'super_admin');
