import { describe, expect, it } from "vitest";
import {
  buildVerifiedRatios,
  calculateMetricsFromFinancials,
  verifyMetricConsistency,
} from "../lib/financial";
import { completeFinancials } from "./fixtures";

describe("pipeline and TypeScript formula parity", () => {
  it("accepts pipeline metrics that match the deterministic formulas", () => {
    const pipelineMetrics = calculateMetricsFromFinancials(completeFinancials);
    const result = verifyMetricConsistency(completeFinancials, pipelineMetrics);

    expect(result.metricsVerified).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.correctedMetricKeys).toEqual([]);
  });

  it("detects a mismatched metric and uses the recalculated value", () => {
    const pipelineMetrics = {
      ...calculateMetricsFromFinancials(completeFinancials),
      current_ratio: 99,
    };
    const result = buildVerifiedRatios(completeFinancials, pipelineMetrics);

    expect(result.audit.metricsVerified).toBe(false);
    expect(result.audit.correctedMetricKeys).toContain("current_ratio");
    expect(result.ratios.currentRatio).toBe(2);
  });

  it("does not convert missing denominators into misleading zero ratios", () => {
    const financials = {
      ...completeFinancials,
      currentLiabilities: 0,
      totalAssets: 0,
      equity: 0,
      revenue: 0,
    };
    const metrics = calculateMetricsFromFinancials(financials);

    expect(metrics.current_ratio).toBeNull();
    expect(metrics.quick_ratio).toBeNull();
    expect(metrics.cash_ratio).toBeNull();
    expect(metrics.debt_ratio).toBeNull();
    expect(metrics.roe).toBeNull();
    expect(metrics.net_profit_margin).toBeNull();
  });
});
