// Single-partner-bank model.
//
// النبض المالي acts as the intermediary between companies/startups and one
// partner bank — preparing and submitting the applicant's information so
// the bank receives a ready-to-review request. "البنك الشريك" (Partner
// Bank) is a placeholder identity by design (see PARTNER_BANK below), so
// this can be pitched to any actual bank without misrepresenting an
// existing partnership.
//
// The platform still estimates an interest rate range tailored to the
// applicant's risk level — that part of the original multi-bank engine is
// still useful and kept here, just scoped to a single bank instead of
// picking a "winner" among several.

import { Bank, PartnerBankQuote, RiskLevel } from "./types";

export const PARTNER_BANK: Bank = {
  id: "partner-bank",
  name: "البنك الشريك",
  minRate: 4,
  maxRate: 9,
  strengths:
    "شريكنا المصرفي الذي نوجّه إليه طلبات التمويل المؤهلة عبر منصة النبض المالي، مع تجهيز جميع البيانات والمؤشرات المالية اللازمة لتسريع مراجعة الطلب.",
};

function estimateRate(riskLevel: RiskLevel): number {
  const t = riskLevel === "low" ? 0.15 : riskLevel === "medium" ? 0.5 : 0.9;
  const rate = PARTNER_BANK.minRate + (PARTNER_BANK.maxRate - PARTNER_BANK.minRate) * t;
  return Math.round(rate * 10) / 10;
}

export function getPartnerBankQuote(
  riskLevel: RiskLevel,
  loanAmount: number
): PartnerBankQuote {
  const notes: string[] = [
    "تم إعداد الطلب تلقائياً بالبيانات المالية اللازمة لمراجعة البنك الشريك",
  ];

  if (riskLevel === "high") {
    notes.push("قد يطلب البنك ضمانات إضافية بناءً على مستوى المخاطر الحالي");
  } else if (riskLevel === "low") {
    notes.push("الملف المالي يتوافق مع معايير الموافقة السريعة لدى البنك الشريك");
  }

  if (loanAmount >= 10_000_000) {
    notes.push("قد تتطلب المبالغ الكبيرة مراجعة إضافية من لجنة الائتمان");
  }

  return {
    bank: PARTNER_BANK,
    estimatedRate: estimateRate(riskLevel),
    notes,
  };
}
