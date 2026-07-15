import {
  CompanyReportData,
  RiskLevel,
  StartupReportData,
  StoredFinancingRequest,
  StoredReport,
} from "./types";

export function deriveRequestProfile(
  request: StoredFinancingRequest,
  report?: StoredReport | null,
) {
  const company = report?.type === "company" ? (report.data as CompanyReportData) : null;
  const startup = report?.type === "startup" ? (report.data as StartupReportData) : null;
  const latest = request.data.monitoring?.snapshots.at(-1);
  const pd = clamp(
    latest?.probabilityOfDefault ??
      request.data.lifecycle?.protectionPlan.defaultProbability ??
      company?.risk.defaultProbability ??
      (startup ? 100 - startup.successProbability : 20),
    0,
    100,
  );
  const risk: RiskLevel =
    request.data.lifecycle?.monitoringPlan.currentRiskLevel ||
    company?.risk.riskLevel ||
    (pd <= 10 ? "low" : pd <= 30 ? "medium" : "high");
  const health = clamp(
    latest?.healthScore ?? company?.risk.healthScore ?? 100 - pd,
    0,
    100,
  );
  const warning = clamp(
    latest?.earlyWarningScore ?? request.data.lifecycle?.monitoringPlan.earlyWarningScore ?? 0,
    0,
    100,
  );
  const amount =
    request.data.creditReview?.approvedAmount ||
    company?.funding.amount ||
    startup?.recommendedCapital ||
    request.data.input.requestedAmount;
  const rate =
    request.data.creditReview?.approvedRate ??
    company?.funding.interestRate ??
    request.data.bankQuote.estimatedRate;
  const exposure = ["disbursed", "monitoring", "warning", "restructured", "defaulted"].includes(request.data.status)
    ? request.data.lifecycle?.monitoringPlan.disbursedAmount || amount
    : 0;
  const recoveryRate = request.data.collateral?.recoveryRate ??
    (request.data.lifecycle?.protectionPlan.expectedRecoveryRate || 0) / 100;
  const expectedLoss = request.data.lifecycle?.protectionPlan.expectedLoss ??
    Math.round(exposure * (pd / 100) * Math.max(0, 1 - recoveryRate));
  return { company, startup, latest, pd, risk, health, warning, amount, rate, exposure, expectedLoss };
}

function clamp(value: number, min: number, max: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}
