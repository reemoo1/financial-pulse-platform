// Single-partner-bank model.
//
// النبض المالي acts as the intermediary between companies/startups and one
// partner bank. The displayed rate must be tied to the applicant's actual
// analysis, not only to the broad risk label. For company reports we therefore
// start from funding.interestRate (which already reflects PD, leverage and
// interest coverage) and apply only quote-specific adjustments such as asking
// for more than the recommended amount or choosing a longer tenor.

import { Bank, PartnerBankQuote, RiskLevel } from "./types";

export const PARTNER_BANK: Bank = {
  id: "partner-bank",
  name: "البنك الشريك",
  // Keep the partner-bank display range aligned with the credit policy in
  // computeFundingRecommendation (5% to 14%).
  minRate: 5,
  maxRate: 14,
  strengths:
    "شريكنا المصرفي الذي نوجّه إليه طلبات التمويل المؤهلة عبر منصة النبض المالي، مع تجهيز جميع البيانات والمؤشرات المالية اللازمة لتسريع مراجعة الطلب.",
};

export interface PartnerBankQuoteInput {
  riskLevel: RiskLevel;
  loanAmount: number;
  /** Rate produced by the company financial-analysis engine. */
  analyzedRate?: number | null;
  /** Recommended limit from the financial-analysis engine. */
  recommendedAmount?: number | null;
  /** Requested repayment tenor. */
  termMonths?: number | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function fallbackRate(riskLevel: RiskLevel): number {
  return riskLevel === "low" ? 6 : riskLevel === "medium" ? 8 : 11;
}

function estimateRate(input: PartnerBankQuoteInput): number {
  const analyzedRate = Number(input.analyzedRate);
  let rate =
    Number.isFinite(analyzedRate) && analyzedRate > 0
      ? analyzedRate
      : fallbackRate(input.riskLevel);

  const loanAmount = Number(input.loanAmount);
  const recommendedAmount = Number(input.recommendedAmount);

  // Asking above the model's recommended limit adds a transparent pricing
  // premium. Asking within the limit does not alter the analyzed base rate.
  if (
    Number.isFinite(loanAmount) &&
    loanAmount > 0 &&
    Number.isFinite(recommendedAmount) &&
    recommendedAmount > 0
  ) {
    const utilization = loanAmount / recommendedAmount;
    if (utilization > 1.5) rate += 1;
    else if (utilization > 1.25) rate += 0.65;
    else if (utilization > 1) rate += 0.35;
  }

  // Longer maturities carry a modest tenor premium. The standard 12-48 month
  // choices preserve the analysis rate exactly.
  const termMonths = Number(input.termMonths);
  if (Number.isFinite(termMonths) && termMonths > 48) rate += 0.25;

  return roundTo(clamp(rate, PARTNER_BANK.minRate, PARTNER_BANK.maxRate), 2);
}

/**
 * Supports the new object signature and the old two-argument signature so
 * existing callers remain compatible.
 */
export function getPartnerBankQuote(
  inputOrRiskLevel: PartnerBankQuoteInput | RiskLevel,
  legacyLoanAmount?: number,
): PartnerBankQuote {
  const input: PartnerBankQuoteInput =
    typeof inputOrRiskLevel === "string"
      ? {
          riskLevel: inputOrRiskLevel,
          loanAmount: Number(legacyLoanAmount) || 0,
        }
      : inputOrRiskLevel;

  const estimatedRate = estimateRate(input);
  const notes: string[] = [
    "تم إعداد الطلب تلقائياً بالبيانات المالية اللازمة لمراجعة البنك الشريك",
  ];

  if (
    Number.isFinite(Number(input.analyzedRate)) &&
    Number(input.analyzedRate) > 0
  ) {
    notes.push(
      "النسبة التقديرية مرتبطة بنتيجة التحليل المالي الفعلية وليست نسبة ثابتة",
    );
  }

  if (input.riskLevel === "high") {
    notes.push("قد يطلب البنك ضمانات إضافية بناءً على مستوى المخاطر الحالي");
  } else if (input.riskLevel === "low") {
    notes.push("الملف المالي يتوافق مبدئياً مع معايير المخاطر المنخفضة");
  }

  if (
    Number(input.recommendedAmount) > 0 &&
    Number(input.loanAmount) > Number(input.recommendedAmount)
  ) {
    notes.push(
      "المبلغ المطلوب أعلى من الحد الموصى به؛ أضيف هامش تسعير تقديري إلى حين مراجعة البنك",
    );
  } else if (Number(input.loanAmount) >= 10_000_000) {
    notes.push("قد تتطلب المبالغ الكبيرة مراجعة إضافية من لجنة الائتمان");
  }

  if (Number(input.termMonths) > 48) {
    notes.push("أضيف هامش بسيط بسبب مدة السداد الطويلة");
  }

  return {
    bank: PARTNER_BANK,
    estimatedRate,
    notes,
  };
}
