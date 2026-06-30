import * as XLSX from "xlsx";
import {
  ExtractedFinancials,
  Ratios,
  RiskScore,
  Vision2030Score,
  FundingRecommendation,
  IndustryBenchmark,
} from "./types";

/* ------------------------------------------------------------------ */
/* 1. Excel extraction                                                 */
/* ------------------------------------------------------------------ */

// Arabic + English keyword variants mapped to canonical financial fields.
// The parser scans every cell of every sheet; when a label cell matches a
// keyword, it looks at the next numeric cell on the same row (then the row
// below) and uses that as the value. This is intentionally tolerant of
// loosely-structured bank/company statement exports.
const KEYWORDS: Record<keyof ExtractedFinancials, string[]> = {
  currentAssets: ["الأصول المتداولة", "اصول متداولة", "current assets"],
  currentLiabilities: [
    "الالتزامات المتداولة",
    "الخصوم المتداولة",
    "current liabilities",
  ],
  totalAssets: ["إجمالي الأصول", "اجمالي الاصول", "total assets"],
  totalLiabilities: [
    "إجمالي الالتزامات",
    "اجمالي الالتزامات",
    "إجمالي الخصوم",
    "total liabilities",
  ],
  netIncome: [
    "صافي الربح",
    "صافي الدخل",
    "net income",
    "net profit",
  ],
  revenue: ["الإيرادات", "الايرادات", "المبيعات", "revenue", "sales", "total revenue"],
  operatingCashFlow: [
    "التدفقات النقدية التشغيلية",
    "التدفق النقدي التشغيلي",
    "operating cash flow",
    "cash flow from operations",
  ],
};

function findNumberInRow(row: unknown[], startIdx: number): number | null {
  for (let i = startIdx; i < row.length; i++) {
    const v = row[i];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string") {
      const cleaned = v.replace(/[, ]/g, "");
      const n = parseFloat(cleaned);
      if (!Number.isNaN(n) && cleaned.match(/^-?\d+(\.\d+)?$/)) return n;
    }
  }
  return null;
}

export function extractFromWorkbookBuffer(
  buffer: ArrayBuffer
): { financials: ExtractedFinancials; warnings: string[] } {
  const workbook = XLSX.read(buffer, { type: "array" });
  const found: Partial<Record<keyof ExtractedFinancials, number>> = {};

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    });

    rows.forEach((row, rowIdx) => {
      row.forEach((cell, cellIdx) => {
        if (typeof cell !== "string") return;
        const cellText = cell.trim();
        if (!cellText) return;

        (Object.keys(KEYWORDS) as (keyof ExtractedFinancials)[]).forEach(
          (field) => {
            if (found[field] !== undefined) return; // first match wins
            const matches = KEYWORDS[field].some((kw) =>
              cellText.toLowerCase().includes(kw.toLowerCase())
            );
            if (!matches) return;

            // Try same row first, then the row directly below.
            let value = findNumberInRow(row, cellIdx + 1);
            if (value === null && rows[rowIdx + 1]) {
              value = findNumberInRow(rows[rowIdx + 1], 0);
            }
            if (value !== null) found[field] = value;
          }
        );
      });
    });
  }

  const warnings: string[] = [];
  const fields = Object.keys(KEYWORDS) as (keyof ExtractedFinancials)[];
  fields.forEach((f) => {
    if (found[f] === undefined) {
      warnings.push(f);
      found[f] = 0;
    }
  });

  return { financials: found as ExtractedFinancials, warnings };
}

/* ------------------------------------------------------------------ */
/* 2. Ratio + Z-Score calculation                                      */
/* ------------------------------------------------------------------ */

export function computeRatios(f: ExtractedFinancials): Ratios {
  const liquidityRatio =
    f.currentLiabilities !== 0 ? f.currentAssets / f.currentLiabilities : 0;
  const debtRatio = f.totalAssets !== 0 ? f.totalLiabilities / f.totalAssets : 0;
  const profitMargin = f.revenue !== 0 ? f.netIncome / f.revenue : 0;
  const cashFlow = f.operatingCashFlow;

  // Simplified Altman Z-Score variant (private-company friendly, partial
  // inputs). This is an approximation for demo/scoring purposes, not a
  // certified credit model.
  const workingCapitalToAssets =
    f.totalAssets !== 0
      ? (f.currentAssets - f.currentLiabilities) / f.totalAssets
      : 0;
  const retainedEarningsProxy =
    f.totalAssets !== 0 ? f.netIncome / f.totalAssets : 0;
  const ebitProxyToAssets = retainedEarningsProxy; // proxy, no separate EBIT field collected
  const equityToLiabilities =
    f.totalLiabilities !== 0
      ? (f.totalAssets - f.totalLiabilities) / f.totalLiabilities
      : 0;
  const salesToAssets = f.totalAssets !== 0 ? f.revenue / f.totalAssets : 0;

  const zScore =
    0.717 * workingCapitalToAssets +
    0.847 * retainedEarningsProxy +
    3.107 * ebitProxyToAssets +
    0.42 * equityToLiabilities +
    0.998 * salesToAssets;

  return {
    liquidityRatio: round2(liquidityRatio),
    debtRatio: round2(debtRatio),
    profitMargin: round2(profitMargin),
    cashFlow: Math.round(cashFlow),
    zScore: round2(zScore),
  };
}

/* ------------------------------------------------------------------ */
/* 3. Risk scoring                                                     */
/* ------------------------------------------------------------------ */

export function computeRiskScore(
  financials: ExtractedFinancials,
  ratios: Ratios
): RiskScore {
  // Weighted scorecard methodology — ported directly from the project's own
  // creditـ_risk.ipynb notebook. That notebook also trained a Random Forest
  // classifier, but on synthetic data whose Risk label was assigned via
  // np.random.choice() independently of the financial ratios — so it had
  // no real signal to learn (~30% accuracy on a 3-class problem, worse than
  // always guessing the majority class). This scorecard is the part of that
  // notebook that's actually sound, so it's what's wired in here instead.
  //
  // Risk_Score = (1 - Debt_Ratio)*40 + Current_Ratio*20 + Profit_Margin*20
  //              + ROA*10 + ROE*10        (0-100, higher = healthier)
  const equity = financials.totalAssets - financials.totalLiabilities;
  const roa = financials.totalAssets !== 0 ? financials.netIncome / financials.totalAssets : 0;
  const roe = equity !== 0 ? financials.netIncome / equity : 0;

  const rawScore =
    (1 - ratios.debtRatio) * 40 +
    ratios.liquidityRatio * 20 +
    ratios.profitMargin * 20 +
    roa * 10 +
    roe * 10;

  const score = clamp(rawScore, 0, 100);

  // Thresholds match the notebook's risk_level() function (70 / 50 split).
  let riskLevel: RiskScore["riskLevel"];
  if (score >= 70) riskLevel = "low";
  else if (score >= 50) riskLevel = "medium";
  else riskLevel = "high";

  // The dashboard displays a "probability of default"-style number (higher
  // = riskier), so invert the 0-100 health score for display purposes.
  const defaultProbability = clamp(Math.round(100 - score), 1, 95);

  return { defaultProbability, riskLevel };
}

/* ------------------------------------------------------------------ */
/* 4. Vision 2030 alignment scoring                                    */
/* ------------------------------------------------------------------ */

const SECTOR_VISION_WEIGHTS: Record<string, number> = {
  "تقنية المعلومات": 88,
  "الصناعة والتصنيع": 80,
  "الطاقة المتجددة": 92,
  "السياحة والترفيه": 85,
  "الخدمات اللوجستية": 78,
  "التجارة والتجزئة": 65,
  "العقارات والمقاولات": 60,
  "الرعاية الصحية": 82,
  "التعليم": 75,
  "الزراعة والأغذية": 70,
  "أخرى": 60,
};

export function computeVision2030Score(
  sector: string,
  employeeCount?: number
): Vision2030Score {
  const base = SECTOR_VISION_WEIGHTS[sector] ?? SECTOR_VISION_WEIGHTS["أخرى"];
  const jobFactor = employeeCount
    ? clamp(Math.round(employeeCount / 5), 0, 15)
    : 5;

  const localization = clamp(base - 5, 0, 100);
  const nonOilContribution = clamp(base, 0, 100);
  const sustainability = clamp(base - 8, 0, 100);
  const jobCreation = clamp(50 + jobFactor, 0, 100);

  const score = Math.round(
    (localization + nonOilContribution + sustainability + jobCreation) / 4
  );

  return {
    score,
    breakdown: { localization, nonOilContribution, sustainability, jobCreation },
  };
}

/* ------------------------------------------------------------------ */
/* 5. Funding recommendation                                           */
/* ------------------------------------------------------------------ */

export function computeFundingRecommendation(
  f: ExtractedFinancials,
  ratios: Ratios,
  risk: RiskScore
): FundingRecommendation {
  const workingCapital = f.currentAssets - f.currentLiabilities;
  const baseAmount = Math.max(workingCapital, 0) * 1.5 + f.revenue * 0.4;
  const amount = Math.round(Math.max(baseAmount, 250000) / 50000) * 50000;

  const baseRate = 4.5;
  const riskPremium =
    risk.riskLevel === "low" ? 0.5 : risk.riskLevel === "medium" ? 2.0 : 4.5;
  const interestRate = round2(baseRate + riskPremium);

  let recommendationText: string;
  if (risk.riskLevel === "low") {
    recommendationText = "الموافقة على التمويل بشروط قياسية";
  } else if (risk.riskLevel === "medium") {
    recommendationText = "الموافقة على التمويل مع ضمانات إضافية";
  } else {
    recommendationText = "يتطلب مراجعة لجنة الائتمان قبل الموافقة";
  }

  return { amount, interestRate, recommendationText };
}

/* ------------------------------------------------------------------ */
/* 6. Industry benchmarks (illustrative reference data)                */
/* ------------------------------------------------------------------ */

const BENCHMARKS: Record<string, IndustryBenchmark> = {
  "تقنية المعلومات": { liquidityRatio: 2.1, debtRatio: 0.35, profitMargin: 0.18 },
  "الصناعة والتصنيع": { liquidityRatio: 1.4, debtRatio: 0.5, profitMargin: 0.1 },
  "الطاقة المتجددة": { liquidityRatio: 1.6, debtRatio: 0.55, profitMargin: 0.12 },
  "السياحة والترفيه": { liquidityRatio: 1.3, debtRatio: 0.45, profitMargin: 0.09 },
  "الخدمات اللوجستية": { liquidityRatio: 1.5, debtRatio: 0.48, profitMargin: 0.08 },
  "التجارة والتجزئة": { liquidityRatio: 1.2, debtRatio: 0.5, profitMargin: 0.07 },
  "العقارات والمقاولات": { liquidityRatio: 1.1, debtRatio: 0.6, profitMargin: 0.11 },
  "الرعاية الصحية": { liquidityRatio: 1.8, debtRatio: 0.4, profitMargin: 0.14 },
  "التعليم": { liquidityRatio: 1.7, debtRatio: 0.3, profitMargin: 0.12 },
  "الزراعة والأغذية": { liquidityRatio: 1.4, debtRatio: 0.42, profitMargin: 0.09 },
  "أخرى": { liquidityRatio: 1.5, debtRatio: 0.45, profitMargin: 0.1 },
};

export function getIndustryBenchmark(sector: string): IndustryBenchmark {
  return BENCHMARKS[sector] ?? BENCHMARKS["أخرى"];
}

export const SECTORS = Object.keys(SECTOR_VISION_WEIGHTS);

/* ------------------------------------------------------------------ */
/* Utils                                                               */
/* ------------------------------------------------------------------ */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
