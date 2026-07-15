import { CreditStage, MonitoringSnapshot, MonitoringStatus } from "./types";

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const change = (current: number, previous?: number) =>
  previous == null || previous === 0
    ? null
    : ((current - previous) / Math.abs(previous)) * 100;

export type EclScenarioInput = {
  name: string;
  weight: number; // 0..1
  ead: number;
  pd: number; // 0..1
  lgd: number; // 0..1
  discountFactor?: number; // 0..1
};

export type MonitoringInput = {
  period: string;
  revenue: number;
  operatingCashFlow: number;
  maintenanceCapex: number;
  totalDebt: number;
  totalAssets: number;
  currentAssets: number;
  currentLiabilities: number;
  scheduledPrincipal: number;
  scheduledInterest: number;
  mandatoryDebtFees: number;
  financeLeasePayments: number;
  installmentDue: number;
  installmentPaid: number;
  daysPastDue?: number;
  unlikelyToPay?: boolean;
  bankruptcy?: boolean;
  enforcementStarted?: boolean;
  distressedRestructuring?: boolean;
  covenantBreach?: boolean;
  ratingDowngrade?: boolean;
  collateralDeterioration?: boolean;
  manualRestageApproved?: boolean;
  eclScenarios?: EclScenarioInput[];
  sourceFileName?: string;
  notes?: string;
};

export function calculateScenarioWeightedEcl(scenarios: EclScenarioInput[]) {
  if (!scenarios.length) return null;
  const valid = scenarios.filter((scenario) =>
    [scenario.weight, scenario.ead, scenario.pd, scenario.lgd].every(Number.isFinite),
  );
  if (!valid.length) return null;
  const weightTotal = valid.reduce((sum, scenario) => sum + Math.max(0, scenario.weight), 0);
  if (weightTotal <= 0) return null;
  return valid.reduce((sum, scenario) => {
    const weight = Math.max(0, scenario.weight) / weightTotal;
    const ead = Math.max(0, scenario.ead);
    const pd = clamp(scenario.pd, 0, 1);
    const lgd = clamp(scenario.lgd, 0, 1);
    const discountFactor = clamp(scenario.discountFactor ?? 1, 0, 1);
    return sum + weight * ead * pd * lgd * discountFactor;
  }, 0);
}

export function buildMonitoringSnapshot(
  input: MonitoringInput,
  previous?: MonitoringSnapshot,
): MonitoringSnapshot {
  const currentRatio = input.currentLiabilities > 0
    ? input.currentAssets / input.currentLiabilities
    : 0;
  const debtRatio = input.totalAssets > 0 ? input.totalDebt / input.totalAssets : 1;
  const maintenanceCapex = Math.max(0, input.maintenanceCapex);
  const cfads = input.operatingCashFlow - maintenanceCapex;
  const contractualDebtService =
    Math.max(0, input.scheduledPrincipal) +
    Math.max(0, input.scheduledInterest) +
    Math.max(0, input.mandatoryDebtFees) +
    Math.max(0, input.financeLeasePayments);
  const dscr = contractualDebtService > 0 ? cfads / contractualDebtService : 0;
  const revenueChange = change(input.revenue, previous?.revenue);
  const cashFlowChange = change(input.operatingCashFlow, previous?.operatingCashFlow);
  const daysPastDue = Math.max(0, Math.round(input.daysPastDue || 0));
  const paymentCoverage = input.installmentDue > 0
    ? Math.max(0, input.installmentPaid / input.installmentDue)
    : 1;

  let warning = 0;
  warning += dscr >= 1.5 ? 0 : dscr >= 1.3 ? 8 : dscr >= 1.1 ? 18 : dscr >= 1 ? 30 : 45;
  warning += currentRatio >= 1.5 ? 0 : currentRatio >= 1.2 ? 7 : currentRatio >= 1 ? 14 : 24;
  warning += debtRatio <= 0.5 ? 0 : debtRatio <= 0.65 ? 8 : debtRatio <= 0.8 ? 16 : 25;
  warning += cfads >= 0 ? 0 : 20;
  warning += revenueChange == null || revenueChange > -10 ? 0 : revenueChange > -20 ? 7 : revenueChange > -30 ? 14 : 20;
  warning += cashFlowChange == null || cashFlowChange > -15 ? 0 : cashFlowChange > -30 ? 8 : 15;
  warning += daysPastDue === 0 ? 0 : daysPastDue <= 15 ? 10 : daysPastDue <= 30 ? 22 : daysPastDue <= 90 ? 32 : 45;
  warning += paymentCoverage >= 1 ? 0 : paymentCoverage >= 0.75 ? 8 : paymentCoverage >= 0.5 ? 15 : 25;
  warning += input.covenantBreach ? 12 : 0;
  warning += input.ratingDowngrade ? 10 : 0;
  warning += input.collateralDeterioration ? 8 : 0;
  const earlyWarningScore = clamp(Math.round(warning));
  const healthScore = clamp(100 - earlyWarningScore);

  // This is an uncalibrated behavioural risk indicator, not a regulatory PD.
  const probabilityOfDefault = clamp(
    Math.round(2 + earlyWarningScore * 0.55 + Math.max(0, daysPastDue - 30) * 0.25),
    1,
    95,
  );

  const stageReasons: string[] = [];
  const qualitativeDefault = Boolean(
    input.unlikelyToPay ||
      input.bankruptcy ||
      input.enforcementStarted ||
      input.distressedRestructuring,
  );
  const quantitativeDefault = daysPastDue > 90;

  let creditStage: CreditStage = "stage1";
  if (quantitativeDefault || qualitativeDefault) {
    creditStage = "stage3";
    if (daysPastDue > 90) stageReasons.push(`تجاوز التأخر 90 يومًا (${daysPastDue} يوم)`);
    if (input.unlikelyToPay) stageReasons.push("وجود مؤشر نوعي على عدم رجحان السداد الكامل");
    if (input.bankruptcy) stageReasons.push("إفلاس أو إجراء إعسار مسجل");
    if (input.enforcementStarted) stageReasons.push("بدء إجراءات تنفيذ أو تحصيل قانونية");
    if (input.distressedRestructuring) stageReasons.push("إعادة هيكلة بسبب صعوبة مالية");
  } else {
    const stage2Signals = [
      daysPastDue > 30 ? `تجاوز التأخر 30 يومًا (${daysPastDue} يوم)` : "",
      input.covenantBreach ? "إخلال بتعهد مالي أو تعاقدي" : "",
      input.ratingDowngrade ? "انخفاض جوهري في التصنيف الداخلي" : "",
      input.collateralDeterioration ? "تدهور جوهري في قيمة أو جودة الضمان" : "",
      dscr < 1.1 ? `انخفاض DSCR إلى ${dscr.toFixed(2)}` : "",
      (revenueChange ?? 0) <= -25
        ? `انخفاض الإيرادات ${Math.abs(revenueChange!).toFixed(1)}%`
        : "",
    ].filter(Boolean);
    if (stage2Signals.length) {
      creditStage = "stage2";
      stageReasons.push(...stage2Signals);
    }
  }

  // Prevent automatic cure to Stage 1 without an approved re-stage decision.
  if (!input.manualRestageApproved && previous?.creditStage === "stage3" && creditStage === "stage1") {
    creditStage = "stage2";
    stageReasons.push("فترة علاج مطلوبة بعد الخروج من التعثر قبل العودة للمرحلة الأولى");
  } else if (!input.manualRestageApproved && previous?.creditStage === "stage2" && creditStage === "stage1") {
    creditStage = "stage2";
    stageReasons.push("لم يعتمد مسؤول المخاطر إعادة التصنيف إلى المرحلة الأولى");
  }

  let status: MonitoringStatus = "healthy";
  if (creditStage === "stage3") status = "default";
  else if (creditStage === "stage2") {
    status = daysPastDue > 30 || dscr < 1 || paymentCoverage < 0.5 || earlyWarningScore >= 50
      ? "high_risk"
      : "watch";
  } else if (
    daysPastDue > 0 ||
    dscr < 1.3 ||
    paymentCoverage < 1 ||
    cfads < 0 ||
    (revenueChange ?? 0) <= -15
  ) {
    status = "watch";
  }

  const alerts: string[] = [];
  if (dscr < 1.3) alerts.push(`انخفاض DSCR إلى ${dscr.toFixed(2)} باستخدام CFADS وخدمة الدين التعاقدية`);
  if (currentRatio < 1.2) alerts.push(`ضعف السيولة الجارية (${currentRatio.toFixed(2)})`);
  if (debtRatio > 0.65) alerts.push(`ارتفاع المديونية إلى ${(debtRatio * 100).toFixed(1)}%`);
  if (cfads < 0) alerts.push("النقد المتاح لخدمة الدين CFADS سالب");
  if ((revenueChange ?? 0) <= -15) alerts.push(`انخفاض الإيرادات ${Math.abs(revenueChange!).toFixed(1)}% عن الفترة السابقة`);
  if (daysPastDue > 0) alerts.push(`تأخر سداد لمدة ${daysPastDue} يوم`);
  if (paymentCoverage < 1) alerts.push(`سداد جزئي بنسبة ${(paymentCoverage * 100).toFixed(1)}% من القسط المستحق`);
  if (input.covenantBreach) alerts.push("تم تسجيل إخلال بتعهد مالي أو تعاقدي");
  if (input.ratingDowngrade) alerts.push("تم تسجيل انخفاض جوهري في التصنيف الداخلي");
  if (input.collateralDeterioration) alerts.push("تم تسجيل تدهور جوهري في الضمانات");

  const recommendedActions = creditStage === "stage3"
    ? ["إحالة الملف للتحصيل وإدارة الحالات المتعثرة", "تقييم قابلية التنفيذ وتفعيل الضمانات", "إعداد خطة استرداد ومخصص ائتماني للحالة المتعثرة"]
    : creditStage === "stage2"
      ? ["إدراج العميل في قائمة المتابعة الخاصة", "إجراء مراجعة ائتمانية شاملة وخطة علاج", "احتساب خسارة ائتمانية متوقعة طوال العمر عند توفر نموذج IFRS 9 معتمد"]
      : status === "watch"
        ? ["طلب كشف حساب وبيانات تشغيلية محدثة", "مراجعة التدفقات النقدية والتعهدات خلال 10 أيام"]
        : ["الاستمرار في المتابعة الدورية وفق الجدول"];

  const expectedCreditLoss = input.eclScenarios
    ? calculateScenarioWeightedEcl(input.eclScenarios)
    : null;
  const eclBasis = creditStage === "stage1"
    ? "12_month"
    : creditStage === "stage2"
      ? "lifetime"
      : "credit_impaired";

  return {
    id: crypto.randomUUID(),
    period: input.period,
    submittedAt: new Date().toISOString(),
    revenue: input.revenue,
    operatingCashFlow: input.operatingCashFlow,
    maintenanceCapex,
    cfads,
    totalDebt: input.totalDebt,
    currentAssets: input.currentAssets,
    currentLiabilities: input.currentLiabilities,
    scheduledPrincipal: input.scheduledPrincipal,
    scheduledInterest: input.scheduledInterest,
    mandatoryDebtFees: input.mandatoryDebtFees,
    financeLeasePayments: input.financeLeasePayments,
    contractualDebtService,
    annualDebtService: contractualDebtService,
    installmentDue: input.installmentDue,
    installmentPaid: input.installmentPaid,
    daysPastDue,
    currentRatio,
    debtRatio,
    dscr,
    dscrMethod: "cfads_contractual",
    revenueChange,
    cashFlowChange,
    healthScore,
    probabilityOfDefault,
    probabilityModelStatus: "uncalibrated",
    regulatoryUseAllowed: false,
    earlyWarningScore,
    creditStage,
    stageReasons,
    status,
    alerts,
    recommendedActions,
    expectedCreditLoss,
    eclBasis,
    sourceFileName: input.sourceFileName,
    notes: input.notes,
  };
}

export function monitoringStatusLabel(status: MonitoringStatus) {
  return ({ healthy: "سليم", watch: "تحت المراقبة", high_risk: "مخاطر مرتفعة", default: "متعثر" } as const)[status];
}

export function creditStageLabel(stage: CreditStage) {
  return ({ stage1: "المرحلة 1 — منتظم", stage2: "المرحلة 2 — متابعة خاصة", stage3: "المرحلة 3 — متعثر ائتمانيًا" } as const)[stage];
}
