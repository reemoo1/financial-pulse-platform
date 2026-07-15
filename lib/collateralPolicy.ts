import policy from "../config/collateral-policy.json";
import { RiskLevel } from "./types";

export interface CollateralCoverageInput {
  riskLevel: RiskLevel;
  defaultProbability: number;
  dscr?: number | null;
  debtRatio?: number | null;
  applicantType?: "company" | "startup";
}

export const COLLATERAL_POLICY_VERSION = policy.version;
export const COLLATERAL_POLICY = policy;

/**
 * سياسة داخلية قابلة للتعديل من config/collateral-policy.json.
 * التمويل منخفض المخاطر ذي DSCR قوي قد لا يحتاج ضماناً عينياً،
 * بينما ترتفع التغطية تدريجياً إلى 100–120% للمخاطر المتوسطة
 * و130–150% للمخاطر المرتفعة.
 */
export function requiredCollateralCoverageRatio(
  input: CollateralCoverageInput,
): number {
  const c = policy.coverage;
  const t = policy.thresholds;
  const pd = Math.max(0, Number(input.defaultProbability || 0));
  const dscr = input.dscr == null ? null : Number(input.dscr);
  const debtRatio = input.debtRatio == null ? null : Number(input.debtRatio);

  if (input.riskLevel === "low") {
    const strongCashFlow = dscr != null && dscr >= t.strongDscr;
    const lowLeverage = debtRatio == null || debtRatio < t.highDebtRatio;
    const established = input.applicantType !== "startup";
    if (strongCashFlow && lowLeverage && pd < t.lowPd && established) {
      return c.lowStrong;
    }
    return c.lowBase;
  }

  if (input.riskLevel === "medium") {
    const elevated =
      pd >= t.elevatedPd ||
      dscr == null ||
      dscr < t.acceptableDscr ||
      (debtRatio != null && debtRatio >= t.highDebtRatio) ||
      input.applicantType === "startup";
    return elevated ? c.mediumElevated : c.mediumBase;
  }

  const severe =
    pd >= 30 ||
    dscr == null ||
    dscr < t.weakDscr ||
    (debtRatio != null && debtRatio >= t.veryHighDebtRatio) ||
    input.applicantType === "startup";
  return severe ? c.highMax : c.highBase;
}

export function requiredCollateralEligibleValue(
  financingAmount: number,
  input: CollateralCoverageInput,
): number {
  if (!Number.isFinite(financingAmount) || financingAmount <= 0) return 0;
  return Math.round(financingAmount * requiredCollateralCoverageRatio(input));
}
