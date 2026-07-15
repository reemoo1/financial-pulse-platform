import { describe, expect, it } from "vitest";
import {
  createAssetFromRecommendation,
  createCollateralPackage,
  recalculateCollateralPackage,
} from "../lib/collateral";
import {
  requiredCollateralCoverageRatio,
  requiredCollateralEligibleValue,
} from "../lib/collateralPolicy";

const baseContext = {
  approvedFinancingAmount: 1_000_000,
  applicantName: "شركة اختبار",
  applicantType: "company" as const,
  sector: "تقنية المعلومات",
  riskLevel: "low" as const,
  defaultProbability: 5,
  dscr: 1.5,
  debtRatio: 0.4,
  company: null,
  startup: null,
};

describe("collateral policy", () => {
  it("calculates the required collateral amount from financing times coverage ratio", () => {
    const ratio = requiredCollateralCoverageRatio(baseContext);
    const value = requiredCollateralEligibleValue(
      baseContext.approvedFinancingAmount,
      baseContext,
    );

    // A strong, established low-risk borrower may be financed on cash flow
    // with only light documentation and no tangible collateral requirement.
    expect(ratio).toBe(0);
    expect(value).toBe(0);
  });

  it("raises coverage deterministically for higher risk factors and respects the cap", () => {
    const ratio = requiredCollateralCoverageRatio({
      riskLevel: "high",
      defaultProbability: 35,
      dscr: 0.9,
      debtRatio: 0.8,
      applicantType: "startup",
    });

    expect(ratio).toBe(1.5);
  });
});

describe("collateral eligible value", () => {
  const securedContext = { ...baseContext, riskLevel: "medium" as const };

  it("uses conservative recovery, costs, time discount and approved status", () => {
    const draft = createCollateralPackage(securedContext, new Date("2026-01-01"));
    const recommendation = draft.recommendations.find(
      (item) => item.type === "real_estate",
    );
    expect(recommendation).toBeTruthy();

    const realEstate = createAssetFromRecommendation(
      recommendation!,
      securedContext.applicantName,
      new Date("2026-01-01"),
    );
    const calculated = recalculateCollateralPackage(
      {
        ...draft,
        assets: [
          ...draft.assets,
          {
            ...realEstate,
            status: "approved",
            valuation: {
              ...realEstate.valuation,
              marketValue: 1_000_000,
              forcedSaleValue: 650_000,
              realisationCosts: 50_000,
              timeToRealiseMonths: 12,
              discountRate: 0.1,
            },
          },
        ],
      },
      new Date("2026-01-02"),
    );

    const asset = calculated.assets.find((item) => item.type === "real_estate");
    expect(asset?.eligibleValue).toBe(545_455);
    expect(asset?.cappedEligibleValue).toBe(545_455);
    expect(calculated.currentEligibleValue).toBe(545_455);
    expect(calculated.coverageRatio).toBe(0.5455);
    expect(calculated.shortfall).toBe(454_545);
  });

  it("does not count client-submitted collateral as approved coverage before bank verification", () => {
    const draft = createCollateralPackage(securedContext, new Date("2026-01-01"));
    const recommendation = draft.recommendations.find(
      (item) => item.type === "real_estate",
    )!;
    const submitted = createAssetFromRecommendation(
      recommendation,
      securedContext.applicantName,
      new Date("2026-01-01"),
    );
    const calculated = recalculateCollateralPackage({
      ...draft,
      assets: [
        ...draft.assets,
        {
          ...submitted,
          status: "submitted",
          valuation: {
            ...submitted.valuation,
            marketValue: 1_000_000,
            forcedSaleValue: 650_000,
          },
        },
      ],
    });

    const asset = calculated.assets.find((item) => item.type === "real_estate");
    expect(asset?.cappedEligibleValue).toBeGreaterThan(0);
    expect(calculated.currentEligibleValue).toBe(0);
    expect(calculated.coverageRatio).toBe(0);
    expect(calculated.shortfall).toBe(1_000_000);
  });
});
