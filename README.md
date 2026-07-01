# النبض المالي (FinancialPulse) — AI Corporate Financing Risk Platform

A working Next.js implementation of the FinancialPulse (النبض المالي) platform: AI-assisted corporate
financing risk analysis and startup feasibility assessment for Saudi banks.

## What's included

- **Frontend**: Next.js 14 (App Router) + TypeScript + TailwindCSS, RTL Arabic UI
- **Backend**: Next.js API routes (Node.js) — no separate server needed
- **Financial engine**: ratio calculation, simplified Z-Score, risk scoring,
  Vision 2030 alignment scoring, funding/interest recommendation (`lib/financial.ts`)
- **Startup engine**: feasibility scoring, SWOT, roadmap, funding sources (`lib/startup.ts`)
- **AI narrative**: optional OpenAI integration with an offline template fallback (`lib/ai.ts`)
- **Excel parsing**: keyword-based extraction from uploaded `.xlsx`/`.xls` financial statements (`lib/financial.ts`)
- **Dashboard**: risk gauge, KPI cards, industry comparison chart, Vision 2030 radar chart, PDF/Excel export
- **Database**: production-ready PostgreSQL schema (`database/schema.sql`); the
  running app uses a local JSON file (`data/db.json`) for zero-config persistence

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000 — that's it, no database setup required for local development.

## Project structure

```
financial-pulse/
├── app/
│   ├── page.tsx                  # Homepage
│   ├── start/page.tsx            # "هل أنت شركة؟" entry choice
│   ├── company/upload/page.tsx   # Excel upload / manual entry
│   ├── startup/wizard/page.tsx   # 3-step startup assessment
│   ├── dashboard/[id]/page.tsx   # Results dashboard (both flows)
│   └── api/
│       ├── companies/analyze/route.ts
│       ├── startups/analyze/route.ts
│       └── reports/[id]/route.ts
├── components/                   # UI components + charts
├── lib/
│   ├── financial.ts               # Ratio/Z-score/risk/Vision2030/funding engine
│   ├── startup.ts                 # Startup feasibility engine
│   ├── ai.ts                      # OpenAI integration + offline fallback
│   ├── store.ts                   # Persistence (JSON file demo / Postgres-ready)
│   └── types.ts
└── database/
    └── schema.sql                 # Full PostgreSQL production schema
```

Also included: `notebooks/` (the original dataset/model notebooks this
project's risk scoring was ported from) and `database/sample-data/` (sample
data + a ready-to-test upload file — see below).

## Connecting a real OpenAI key (optional)

Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY`. With no key set,
the app generates report narratives from a deterministic Arabic template
instead, so it works fully offline out of the box.

## Connecting a real PostgreSQL database (for production)

1. Create a database and run:
   ```bash
   psql -U postgres -d financial_pulse -f database/schema.sql
   ```
2. Set `DATABASE_URL` in `.env.local`.
3. Install the `pg` package: `npm install pg`
4. Replace the functions in `lib/store.ts` with real queries — a reference
   snippet using `pg` is included as a comment at the bottom of that file.

## Deploying it live (Vercel + Postgres)

Local dev uses a JSON file for storage — fine for `localhost`, but most
hosts (including Vercel) don't guarantee that file persists between
requests. For a real deployed link, connect a Postgres database and the
app will automatically switch to using it instead (see `lib/store.ts` —
it checks for `DATABASE_URL` and routes accordingly, no code changes
needed).

**1. Create a free Postgres database**
Easiest option: from your Vercel project dashboard → **Storage** tab →
**Create Database** → **Postgres** (powered by Neon). This auto-generates
a `DATABASE_URL` and adds it to your project's environment variables for
you. Alternatives that work just as well: [neon.tech](https://neon.tech) or
[supabase.com](https://supabase.com), both free tier — just copy their
connection string into `DATABASE_URL` yourself if you go that route.

**2. Create the reports table**
Run `database/reports-table.sql` once against that database — either
through your provider's built-in SQL editor (Vercel/Neon/Supabase all have
one in their dashboard), or locally:
```bash
psql "$DATABASE_URL" -f database/reports-table.sql
```

**3. Deploy on Vercel**
- Go to [vercel.com/new](https://vercel.com/new), sign in with GitHub
- Import your `financial-pulse-platform` repo
- If you created the database from within Vercel in step 1, `DATABASE_URL`
  is already set. Otherwise, add it manually under **Settings → Environment
  Variables**
- (Optional) also add `OPENAI_API_KEY` there if you want real AI-generated
  narratives instead of the template fallback
- Click **Deploy**

You'll get a live `https://your-project.vercel.app` link. Every future
`git push` to `main` auto-deploys an update.

## Financing request & the partner bank model

The platform positions النبض المالي as the intermediary between
companies/startups and **one partner bank** — not a marketplace comparing
multiple banks. From either dashboard, the **تقديم طلب تمويل** button leads
to `/financing-request/[id]`, where the applicant sees:

- The partner bank ("**البنك الشريك**" — a deliberate placeholder name, see
  below), with an estimated interest rate tailored to their risk level
  (`lib/banks.ts`'s `getPartnerBankQuote`)
- A short explanation of the platform's role as intermediary — preparing
  the applicant's financial data so the bank receives a ready-to-review
  request
- A form to actually submit the request

**On the placeholder bank name:** "البنك الشريك" is intentionally generic
rather than naming a specific real bank, since this is meant to be
pitchable to *any* bank without implying a partnership that doesn't yet
exist. If/when a real partnership is in place, update `PARTNER_BANK` in
`lib/banks.ts` with the real name and adjust the rate range to match that
bank's actual terms.

Submitted requests are stored using the same `reports` table as everything
else (just with `type = 'financing_request'`) — no extra database
migration needed. After submitting, the applicant gets a confirmation
screen with a downloadable PDF summary of their request.

## Notes on the Excel parser

The uploaded-statement parser (`extractFromWorkbookBuffer` in `lib/financial.ts`)
scans every cell of every sheet for Arabic/English keywords (e.g. "الأصول
المتداولة" / "current assets") and reads the nearest numeric cell. It's
tolerant of loosely structured exports but works best when each line item
label sits next to (or directly above) its value. For PDF statements, use
the "إدخال يدوي" (manual entry) tab on the upload page instead — full PDF
table extraction is intentionally left out of this scaffold (see Phase 2 in
the architecture doc for the recommended OCR-based approach).

## Risk scoring methodology

`computeRiskScore` in `lib/financial.ts` uses a transparent weighted
scorecard ported directly from this project's own `creditـ_risk.ipynb`
notebook:

```
Risk_Score = (1 - Debt_Ratio)×40 + Current_Ratio×20 + Profit_Margin×20 + ROA×10 + ROE×10
```
with a 70/50 split into Low/Medium/High risk, matching the notebook's
`risk_level()` function.

That notebook also trained a Random Forest classifier on a synthetic
150-company dataset (`create_dataset.ipynb`) — but the dataset's `Risk`
column was assigned with `np.random.choice(..., p=[0.4, 0.35, 0.25])`,
independent of the financial ratios. There's no real relationship between
the features and the label for a classifier to learn, which is borne out
in the notebook's own results: ~30% accuracy on a 3-class problem (worse
than always predicting the majority class). That model is **not** wired
into this app for that reason. The scorecard above — the part of the
notebook that's actually sound — is what's used instead.

## Sample data

`database/sample-data/` contains:
- `sample_companies_150.csv` — the 150-company synthetic dataset, regenerated
  deterministically from `create_dataset.ipynb` (`np.random.seed(42)`).
  Useful as reference data or for seeding a real database — not as ML
  training data, for the reason above.
- `sample_statement_for_upload_test.xlsx` — a ready-to-use test file in the
  exact label format the upload parser expects. Use this on the
  `/company/upload` page to test the "رفع ملف" flow end-to-end without
  needing a real bank statement.


## Known limitations of this scaffold (by design, to stay runnable end-to-end)

- Persistence is a local JSON file by default — fine for demos, not for
  multi-user production (swap in the Postgres schema for that).
- The R statistical microservice and Power BI integration from the original
  architecture spec are represented here by an equivalent TypeScript scoring
  engine (`lib/financial.ts`) so the whole thing runs as a single `npm run dev`
  — swap in the real R/Python services behind the same function signatures
  when you're ready to scale.
- Risk/feasibility scoring uses a transparent, documented scorecard (ported
  from this project's own notebook — see "Risk scoring methodology" above)
  rather than a trained ML model, since the only model trained so far had
  no real signal to learn from. Swap in a properly trained model (on real,
  non-randomly-labeled outcome data) when one's available; the call site
  (`computeRiskScore` / `analyzeStartup`) is isolated specifically so
  that's a drop-in swap.
