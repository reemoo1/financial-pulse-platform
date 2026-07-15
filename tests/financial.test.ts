import { describe, expect, it } from "vitest";
import {
  calculateMetricsFromFinancials,
  computeFundingRecommendation,
  computeRatios,
  computeRiskScore,
} from "../lib/financial";
import { completeFinancials, withoutBankingSupplement } from "./fixtures";

describe("financial ratios", () => {
  it("calculates liquidity, leverage, profitability and cash-flow ratios", () => {
    const metrics = calculateMetricsFromFinancials(completeFinancials);

    expect(metrics.current_ratio).toBe(2);
    expect(metrics.quick_ratio).toBe(1.75);
    expect(metrics.cash_ratio).toBe(0.4);
    expect(metrics.working_capital).toBe(2_000_000);
    expect(metrics.debt_to_equity).toBe(0.6667);
    expect(metrics.debt_ratio).toBe(0.4);
    expect(metrics.equity_ratio).toBe(0.6);
    expect(metrics.gross_profit_margin).toBe(0.4167);
    expect(metrics.operating_margin).toBe(0.1667);
    expect(metrics.net_profit_margin).toBe(0.1167);
    expect(metrics.roa).toBe(0.14);
    expect(metrics.roe).toBe(0.2333);
    expect(metrics.interest_coverage).toBe(10);
    expect(metrics.operating_cash_flow_ratio).toBe(1.2);
    expect(metrics.operating_cash_flow_to_debt).toBe(0.6);
    expect(metrics.free_cash_flow).toBe(1_800_000);
    expect(metrics.asset_turnover).toBe(1.2);
    expect(metrics.inventory_turnover).toBe(14);
    expect(metrics.receivables_turnover).toBe(12);
  });

  it("uses contractual debt service for DSCR", () => {
    const metrics = calculateMetricsFromFinancials(completeFinancials);

    expect(metrics.cfads).toBe(2_000_000);
    expect(metrics.contractual_debt_service).toBe(800_000);
    expect(metrics.dscr).toBe(2.5);
    expect(metrics.dscr_method).toBe("cfads_contractual");
    expect(metrics.banking_data_quality).toBe(100);
  });

  it("derives CFADS from operating cash flow less maintenance capex when explicit CFADS is absent", () => {
    const metrics = calculateMetricsFromFinancials({
      ...completeFinancials,
      cfads: null,
    });

    expect(metrics.cfads).toBe(2_000_000);
    expect(metrics.dscr).toBe(2.5);
    expect(metrics.dscr_method).toBe("ocf_less_maintenance_capex");
  });

  it("calculates the full private-company Altman Z-prime formula", () => {
    const metrics = calculateMetricsFromFinancials(completeFinancials);

    expect(metrics.altman_z_score).toBe(2.7618);
    expect(metrics.altman_model).toBe("private_full");
  });

  it("marks Altman and DSCR unavailable when required inputs are missing", () => {
    const metrics = calculateMetricsFromFinancials(withoutBankingSupplement());

    expect(metrics.altman_z_score).toBeNull();
    expect(metrics.altman_model).toBe("unavailable");
    expect(metrics.dscr).toBeNull();
    expect(metrics.dscr_method).toBe("unavailable");
  });
});

describe("funding recommendation", () => {
  it("produces a bounded, internally consistent recommendation when banking data is complete", () => {
    const ratios = computeRatios(completeFinancials);
    const risk = computeRiskScore(completeFinancials, ratios);
    const funding = computeFundingRecommendation(completeFinancials, ratios, risk);

    expect(funding.calculation?.debtServiceDataComplete).toBe(true);
    expect(funding.amount).toBeGreaterThan(0);
    expect(funding.amount % 50_000).toBe(0);
    expect(funding.interestRate).toBeGreaterThanOrEqual(5);
    expect(funding.interestRate).toBeLessThanOrEqual(14);
    expect(funding.recommendedTermMonths).toBeGreaterThan(0);
    expect(funding.estimatedMonthlyInstallment).toBeGreaterThan(0);
    expect(funding.maxAffordableInstallment).toBeGreaterThan(0);
    expect(funding.estimatedMonthlyInstallment).toBeLessThanOrEqual(
      funding.maxAffordableInstallment as number,
    );
    expect(funding.dscrAfterFinancing).not.toBeNull();

    const capacities = [
      funding.calculation?.cashFlowCapacity,
      funding.calculation?.assetBackedCapacity,
      funding.calculation?.leverageCapacity,
      funding.calculation?.revenueCapacity,
    ].filter((value): value is number => value !== null && value !== undefined);
    expect(funding.amount).toBeLessThanOrEqual(Math.min(...capacities));
  });

  it("shows a conservative preliminary amount when banking inputs are missing without treating it as bank approval", () => {
    const financials = withoutBankingSupplement();
    const ratios = computeRatios(financials);
    const risk = computeRiskScore(financials, ratios);
    const funding = computeFundingRecommendation(financials, ratios, risk);

    expect(funding.amount).toBeGreaterThan(0);
    expect(funding.amount % 50_000).toBe(0);
    expect(funding.estimatedMonthlyInstallment).toBeGreaterThan(0);
    expect(funding.dscrAfterFinancing).toBeNull();
    expect(funding.isPreliminary).toBe(true);
    expect(funding.eligibility).toBe("committee_review");
    expect(funding.calculation?.debtServiceDataComplete).toBe(false);
    expect(funding.calculation?.recommendationMode).toBe(
      "preliminary_statements",
    );
    expect(funding.calculation?.missingBankingInputs.length).toBeGreaterThan(0);
    expect(funding.recommendationText).toContain("تقدير تمويلي أولي");
    expect(funding.collateral?.requiredEligibleValue).toBe(
      Math.round(
        funding.amount * (funding.collateral?.requiredCoverageRatio || 0),
      ),
    );
  });

  it("treats a complete zero existing debt-service schedule as valid rather than missing", () => {
    const financials = {
      ...completeFinancials,
      scheduledPrincipal: 0,
      scheduledInterest: 0,
      mandatoryDebtFees: 0,
      financeLeasePayments: 0,
    };
    const ratios = computeRatios(financials);
    const risk = computeRiskScore(financials, ratios);
    const funding = computeFundingRecommendation(financials, ratios, risk);

    expect(ratios.contractualDebtService).toBe(0);
    expect(ratios.dscr).toBeNull();
    expect(funding.calculation?.debtServiceDataComplete).toBe(true);
    expect(funding.calculation?.existingAnnualDebtService).toBe(0);
    expect(funding.isPreliminary).toBe(false);
    expect(funding.amount).toBeGreaterThan(0);
  });
});
