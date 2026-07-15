import { describe, expect, it } from "vitest";
import { getPartnerBankQuote } from "../lib/banks";
import { computeFundingRecommendation, computeRatios, computeRiskScore } from "../lib/financial";
import { completeFinancials } from "./fixtures";

describe("partner-bank estimated rate", () => {
  it("uses the company analysis rate instead of a fixed rate per risk label", () => {
    const strongFile = getPartnerBankQuote({
      riskLevel: "low",
      loanAmount: 1_000_000,
      recommendedAmount: 1_500_000,
      analyzedRate: 5.35,
      termMonths: 36,
    });
    const weakerFile = getPartnerBankQuote({
      riskLevel: "low",
      loanAmount: 1_000_000,
      recommendedAmount: 1_500_000,
      analyzedRate: 6.85,
      termMonths: 36,
    });

    expect(strongFile.estimatedRate).toBe(5.35);
    expect(weakerFile.estimatedRate).toBe(6.85);
    expect(strongFile.estimatedRate).not.toBe(weakerFile.estimatedRate);
  });

  it("adds a premium when the requested amount exceeds the recommended limit", () => {
    const withinLimit = getPartnerBankQuote({
      riskLevel: "medium",
      loanAmount: 1_000_000,
      recommendedAmount: 1_000_000,
      analyzedRate: 7.2,
      termMonths: 48,
    });
    const aboveLimit = getPartnerBankQuote({
      riskLevel: "medium",
      loanAmount: 1_300_000,
      recommendedAmount: 1_000_000,
      analyzedRate: 7.2,
      termMonths: 48,
    });

    expect(withinLimit.estimatedRate).toBe(7.2);
    expect(aboveLimit.estimatedRate).toBe(7.85);
  });

  it("adds a small tenor premium above 48 months", () => {
    const standardTerm = getPartnerBankQuote({
      riskLevel: "low",
      loanAmount: 500_000,
      recommendedAmount: 500_000,
      analyzedRate: 5.7,
      termMonths: 48,
    });
    const longTerm = getPartnerBankQuote({
      riskLevel: "low",
      loanAmount: 500_000,
      recommendedAmount: 500_000,
      analyzedRate: 5.7,
      termMonths: 60,
    });

    expect(standardTerm.estimatedRate).toBe(5.7);
    expect(longTerm.estimatedRate).toBe(5.95);
  });


  it("changes end-to-end when two uploaded financial files have different risk metrics", () => {
    const strongRatios = computeRatios(completeFinancials);
    const strongRisk = computeRiskScore(completeFinancials, strongRatios);
    const strongFunding = computeFundingRecommendation(
      completeFinancials,
      strongRatios,
      strongRisk,
    );

    const stressedFinancials = {
      ...completeFinancials,
      currentAssets: 2_200_000,
      cash: 250_000,
      inventory: 600_000,
      totalLiabilities: 7_500_000,
      currentLiabilities: 2_000_000,
      shortTermDebt: 1_500_000,
      longTermDebt: 4_800_000,
      equity: 2_500_000,
      retainedEarnings: 300_000,
      operatingIncome: 500_000,
      netIncome: 100_000,
      interestExpense: 400_000,
      operatingCashFlow: 700_000,
      cfads: 500_000,
      scheduledPrincipal: 450_000,
      scheduledInterest: 400_000,
      financeLeasePayments: 100_000,
    };
    const stressedRatios = computeRatios(stressedFinancials);
    const stressedRisk = computeRiskScore(stressedFinancials, stressedRatios);
    const stressedFunding = computeFundingRecommendation(
      stressedFinancials,
      stressedRatios,
      stressedRisk,
    );

    const strongQuote = getPartnerBankQuote({
      riskLevel: strongRisk.riskLevel,
      loanAmount: strongFunding.amount,
      recommendedAmount: strongFunding.amount,
      analyzedRate: strongFunding.interestRate,
      termMonths: strongFunding.recommendedTermMonths,
    });
    const stressedQuote = getPartnerBankQuote({
      riskLevel: stressedRisk.riskLevel,
      loanAmount: Math.max(stressedFunding.amount, 1),
      recommendedAmount: stressedFunding.amount,
      analyzedRate: stressedFunding.interestRate,
      termMonths: stressedFunding.recommendedTermMonths,
    });

    expect(stressedFunding.interestRate).toBeGreaterThan(
      strongFunding.interestRate,
    );
    expect(stressedQuote.estimatedRate).toBeGreaterThan(
      strongQuote.estimatedRate,
    );
  });

  it("keeps the legacy signature working with risk-based fallback rates", () => {
    expect(getPartnerBankQuote("low", 500_000).estimatedRate).toBe(6);
    expect(getPartnerBankQuote("medium", 500_000).estimatedRate).toBe(8);
    expect(getPartnerBankQuote("high", 500_000).estimatedRate).toBe(11);
  });
});
