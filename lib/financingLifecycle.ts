import {
  CompanyReportData,
  FinancingJourneyStage,
  FinancingJourneyStatus,
  FinancingLifecyclePlan,
  FinancingRequestInput,
  FundingRecommendation,
  RiskLevel,
  RiskScore,
  StartupReportData,
} from "./types";

const CANONICAL_STATUS: Record<string, FinancingJourneyStatus> = {
  pending: "submitted",
  under_review: "bank_review",
};

export const FINANCING_STATUS_LABELS: Record<FinancingJourneyStatus, string> = {
  draft: "مسودة",
  submitted: "تم تقديم الطلب",
  data_review: "جاري التحقق من البيانات",
  analysis_completed: "تم التحليل",
  bank_review: "تحت مراجعة البنك",
  conditional_approval: "موافقة مشروطة",
  guarantee_required: "بانتظار الضمانات",
  approved: "تمت الموافقة على التمويل",
  rejected: "مرفوض",
  disbursed: "تم صرف التمويل",
  monitoring: "تحت المتابعة",
  warning: "إنذار مبكر",
  restructured: "تمت إعادة الجدولة",
  closed: "مكتمل",
  defaulted: "متعثر",
  pending: "قيد المراجعة",
  under_review: "قيد المراجعة",
};

const JOURNEY_STAGES: Omit<FinancingJourneyStage, "state" | "completedAt">[] = [
  {
    key: "submitted",
    label: "تقديم الطلب",
    description: "استلام بيانات الشركة وطلب التمويل.",
  },
  {
    key: "data_review",
    label: "التحقق من البيانات",
    description: "التأكد من اكتمال القوائم المالية وصحة القيم.",
  },
  {
    key: "analysis_completed",
    label: "التحليل المالي",
    description: "حساب المؤشرات والمخاطر والتوصية التمويلية.",
  },
  {
    key: "bank_review",
    label: "مراجعة البنك",
    description: "فحص الطلب من جهة التمويل ومطابقة السياسات الائتمانية.",
  },
  {
    key: "conditional_approval",
    label: "موافقة مشروطة",
    description: "الموافقة الأولية مرتبطة بالشروط والضمانات.",
  },
  {
    key: "guarantee_required",
    label: "تحديد الضمانات",
    description: "تسجيل الضمانات المطلوبة قبل الصرف النهائي.",
  },
  {
    key: "approved",
    label: "اعتماد التمويل",
    description: "اعتماد مبلغ التمويل وجدول السداد.",
  },
  {
    key: "disbursed",
    label: "صرف التمويل",
    description: "صرف التمويل مرة واحدة أو على دفعات حسب شروط الموافقة.",
  },
  {
    key: "monitoring",
    label: "متابعة شهرية",
    description: "متابعة السداد والتدفقات النقدية ومؤشرات التعثر.",
  },
  {
    key: "warning",
    label: "إنذار مبكر",
    description: "تنبيه عند انخفاض قدرة السداد أو ظهور مؤشرات خطر.",
  },
  {
    key: "restructured",
    label: "إعادة جدولة",
    description: "تعديل مدة السداد أو الأقساط قبل التعثر الكامل.",
  },
  {
    key: "closed",
    label: "إغلاق التمويل",
    description: "إغلاق التمويل بعد السداد الكامل أو التسوية.",
  },
  {
    key: "defaulted",
    label: "تعثر",
    description: "تفعيل إجراءات الضمانات والاسترداد عند التعثر.",
  },
];

const JOURNEY_ORDER = JOURNEY_STAGES.map((stage) => stage.key);

export function canonicalFinancingStatus(
  status?: FinancingJourneyStatus,
): FinancingJourneyStatus {
  if (!status) return "analysis_completed";
  return CANONICAL_STATUS[status] || status;
}

export function getFinancingStatusLabel(status?: FinancingJourneyStatus) {
  const key = status || "analysis_completed";
  return FINANCING_STATUS_LABELS[key] || key;
}

export function buildCompanyFinancingLifecycle(
  data: Pick<CompanyReportData, "funding" | "risk" | "ratios" | "financials">,
  status: FinancingJourneyStatus = "analysis_completed",
  input?: Partial<FinancingRequestInput>,
  now = new Date(),
): FinancingLifecyclePlan {
  const amount =
    positiveNumber(input?.requestedAmount) ||
    positiveNumber(data.funding.amount);
  const termMonths =
    positiveNumber(input?.termMonths) ||
    positiveNumber(data.funding.recommendedTermMonths) ||
    60;
  const monthlyInstallment =
    positiveNumber(data.funding.estimatedMonthlyInstallment) ||
    estimateMonthlyInstallment(amount, data.funding.interestRate, termMonths);

  return buildLifecyclePlan({
    status,
    amount,
    termMonths,
    monthlyInstallment,
    risk: data.risk,
    funding: data.funding,
    dscrAfterFinancing: data.funding.dscrAfterFinancing,
    debtRatio: data.ratios.debtRatio,
    operatingCashFlowRatio: data.ratios.operatingCashFlowRatio,
    currentRatio: data.ratios.currentRatio,
    zScore: data.ratios.zScore,
    cash: data.financials.cash,
    now,
  });
}

export function buildStartupFinancingLifecycle(
  data: StartupReportData,
  status: FinancingJourneyStatus = "analysis_completed",
  input?: Partial<FinancingRequestInput>,
  now = new Date(),
): FinancingLifecyclePlan {
  const amount =
    positiveNumber(input?.requestedAmount) || Math.max(data.fundingNeeded, 0);
  const termMonths = positiveNumber(input?.termMonths) || 36;
  const success = data.successProbability || 50;
  const riskLevel: RiskLevel =
    success >= 65 ? "low" : success >= 45 ? "medium" : "high";
  const defaultProbability = clamp(100 - success, 5, 80);
  const funding: FundingRecommendation = {
    amount,
    interestRate: riskLevel === "low" ? 6 : riskLevel === "medium" ? 8 : 11,
    recommendationText: riskLevel === "low" ? "مؤهل مبدئياً" : "موافقة مشروطة",
    recommendedTermMonths: termMonths,
    estimatedMonthlyInstallment: estimateMonthlyInstallment(
      amount,
      riskLevel === "low" ? 6 : riskLevel === "medium" ? 8 : 11,
      termMonths,
    ),
    dscrAfterFinancing: null,
  };

  return buildLifecyclePlan({
    status,
    amount,
    termMonths,
    monthlyInstallment: funding.estimatedMonthlyInstallment || 0,
    risk: { riskLevel, defaultProbability, healthScore: success },
    funding,
    dscrAfterFinancing: null,
    debtRatio: null,
    operatingCashFlowRatio: null,
    currentRatio: null,
    zScore: null,
    cash: data.input.currentCapital,
    now,
  });
}

export function refreshFinancingLifecycleStatus(
  lifecycle: FinancingLifecyclePlan,
  status: FinancingJourneyStatus,
  input?: Partial<FinancingRequestInput>,
  now = new Date(),
): FinancingLifecyclePlan {
  const amount =
    positiveNumber(input?.requestedAmount) ||
    lifecycle.protectionPlan.fundingAmount;
  const termMonths =
    positiveNumber(input?.termMonths) ||
    lifecycle.monitoringPlan.remainingInstallments ||
    60;
  const monthlyInstallment = lifecycle.monitoringPlan.monthlyInstallment;
  const defaultProbability = lifecycle.protectionPlan.defaultProbability;
  const riskLevel: RiskLevel =
    status === "defaulted" || status === "warning"
      ? "high"
      : status === "restructured"
        ? "medium"
        : lifecycle.monitoringPlan.currentRiskLevel;

  return buildLifecyclePlan({
    status,
    amount,
    termMonths,
    monthlyInstallment,
    risk: {
      defaultProbability,
      riskLevel,
      healthScore: 100 - defaultProbability,
    },
    funding: {
      amount,
      interestRate: 0,
      recommendationText: "",
      recommendedTermMonths: termMonths,
      estimatedMonthlyInstallment: monthlyInstallment,
      dscrAfterFinancing: null,
    },
    dscrAfterFinancing: null,
    debtRatio: null,
    operatingCashFlowRatio: null,
    currentRatio: null,
    zScore: null,
    cash: null,
    now,
  });
}

function buildLifecyclePlan(input: {
  status: FinancingJourneyStatus;
  amount: number;
  termMonths: number;
  monthlyInstallment: number;
  risk: RiskScore;
  funding: FundingRecommendation;
  dscrAfterFinancing: number | null | undefined;
  debtRatio: number | null | undefined;
  operatingCashFlowRatio: number | null | undefined;
  currentRatio: number | null | undefined;
  zScore: number | null | undefined;
  cash: number | null | undefined;
  now: Date;
}): FinancingLifecyclePlan {
  const status = canonicalFinancingStatus(input.status);
  const stages = buildStages(status, input.now);
  const guaranteePlan = buildGuaranteePlan(
    input.amount,
    input.risk,
    input.funding.eligibility,
    status,
  );
  const monitoringPlan = buildMonitoringPlan(input);
  const protectionPlan = buildProtectionPlan(
    input.amount,
    input.risk,
    guaranteePlan,
    status,
  );

  return {
    status,
    statusLabel: getFinancingStatusLabel(status),
    stages,
    guaranteePlan,
    monitoringPlan,
    protectionPlan,
    nextActions: buildNextActions(status, monitoringPlan, guaranteePlan),
    methodology:
      "رحلة التمويل مبنية على حالة الطلب، قدرة السداد، DSCR بعد التمويل، مستوى المخاطر، وقيمة الضمانات قبل وبعد الصرف.",
  };
}

function buildStages(
  status: FinancingJourneyStatus,
  now: Date,
): FinancingJourneyStage[] {
  const current = canonicalFinancingStatus(status);
  const currentIndex = JOURNEY_ORDER.indexOf(current);
  const safeIndex =
    currentIndex === -1
      ? JOURNEY_ORDER.indexOf("analysis_completed")
      : currentIndex;
  const rejected = current === "rejected";

  return JOURNEY_STAGES.map((stage, index) => {
    let state: FinancingJourneyStage["state"] = "pending";
    if (rejected && index > JOURNEY_ORDER.indexOf("bank_review"))
      state = "blocked";
    else if (index < safeIndex) state = "completed";
    else if (index === safeIndex) state = "current";

    return {
      ...stage,
      state,
      completedAt:
        state === "completed" || state === "current"
          ? now.toISOString()
          : undefined,
    };
  });
}

function buildGuaranteePlan(
  amount: number,
  risk: RiskScore,
  eligibility: FundingRecommendation["eligibility"],
  status: FinancingJourneyStatus,
) {
  const baseCoverage =
    risk.riskLevel === "low" ? 0.5 : risk.riskLevel === "medium" ? 0.75 : 1;
  const eligibilityAddon =
    eligibility === "committee_review"
      ? 0.15
      : eligibility === "conditional"
        ? 0.05
        : 0;
  const coverageRatio = clamp(baseCoverage + eligibilityAddon, 0.35, 1.2);
  const requiredAmount = Math.round((amount * coverageRatio) / 1000) * 1000;
  const accepted = [
    "approved",
    "disbursed",
    "monitoring",
    "warning",
    "restructured",
    "closed",
  ].includes(status);
  const requested = ["guarantee_required", "conditional_approval"].includes(
    status,
  );

  const itemStatus = accepted
    ? "accepted"
    : requested
      ? "requested"
      : "not_requested";
  const statusValue = accepted
    ? "accepted"
    : requiredAmount > 0
      ? requested
        ? "pending_submission"
        : "required"
      : "not_required";

  return {
    requiredAmount,
    coverageRatio,
    recommendedType:
      risk.riskLevel === "low"
        ? "ضمان مشروط مع سند لأمر"
        : risk.riskLevel === "medium"
          ? "رهن أصول + سند لأمر + ضمان شخصي"
          : "رهن أصول مرتفع التغطية + تحويل مستحقات + ضمان شخصي",
    status: statusValue as
      | "not_required"
      | "required"
      | "pending_submission"
      | "accepted"
      | "rejected",
    items: [
      {
        type: "promissory_note" as const,
        label: "سند لأمر",
        required: true,
        estimatedValue: Math.round(requiredAmount * 0.25),
        status: itemStatus as
          "not_requested" | "requested" | "submitted" | "accepted" | "rejected",
        note: "يدعم حق المطالبة عند التأخر بالسداد.",
      },
      {
        type: "asset_pledge" as const,
        label: "رهن أصول أو معدات",
        required: risk.riskLevel !== "low",
        estimatedValue: Math.round(requiredAmount * 0.45),
        status: itemStatus as
          "not_requested" | "requested" | "submitted" | "accepted" | "rejected",
        note: "يستخدم لتقليل الخسارة المتوقعة عند التعثر.",
      },
      {
        type: "kafalah" as const,
        label: "تغطية برنامج كفالة عند الأهلية",
        required: risk.riskLevel !== "high",
        estimatedValue: Math.round(requiredAmount * 0.2),
        status: itemStatus as
          "not_requested" | "requested" | "submitted" | "accepted" | "rejected",
        note: "يقترح كخيار لتخفيف مخاطر جهة التمويل عند انطباق الشروط.",
      },
      {
        type: "receivables_assignment" as const,
        label: "تحويل مستحقات العملاء",
        required: risk.riskLevel === "high",
        estimatedValue: Math.round(requiredAmount * 0.1),
        status: itemStatus as
          "not_requested" | "requested" | "submitted" | "accepted" | "rejected",
        note: "مفيد عندما تعتمد الشركة على عقود أو فواتير مستحقة.",
      },
    ],
    notes: [
      "لا يتم صرف التمويل النهائي قبل قبول الضمانات المطلوبة.",
      "يمكن تخفيض مبلغ التمويل إذا لم تكفِ الضمانات أو ضعف DSCR بعد التمويل.",
    ],
  };
}

function buildMonitoringPlan(input: {
  status: FinancingJourneyStatus;
  amount: number;
  termMonths: number;
  monthlyInstallment: number;
  risk: RiskScore;
  dscrAfterFinancing: number | null | undefined;
  debtRatio: number | null | undefined;
  operatingCashFlowRatio: number | null | undefined;
  currentRatio: number | null | undefined;
  zScore: number | null | undefined;
  cash: number | null | undefined;
  now: Date;
}) {
  const status = canonicalFinancingStatus(input.status);
  const isDisbursed = [
    "disbursed",
    "monitoring",
    "warning",
    "restructured",
    "closed",
    "defaulted",
  ].includes(status);
  const disbursedAmount = isDisbursed ? input.amount : 0;
  const paidInstallments =
    status === "closed" ? input.termMonths : status === "monitoring" ? 1 : 0;
  const remainingInstallments = Math.max(
    input.termMonths - paidInstallments,
    0,
  );
  const firstInstallmentDate = addMonths(input.now, 1).toISOString();
  const lastInstallmentDate = addMonths(
    input.now,
    input.termMonths,
  ).toISOString();
  const nextReviewDate = addMonths(input.now, 1).toISOString();

  const alerts = buildEarlyWarningAlerts(input);
  const earlyWarningComponents = buildEarlyWarningComponents(input);
  let earlyWarningScore = Math.round(
    earlyWarningComponents.reduce(
      (sum, component) => sum + component.contribution,
      0,
    ),
  );
  if (status === "warning") earlyWarningScore = Math.max(earlyWarningScore, 75);
  if (status === "restructured") earlyWarningScore = Math.max(earlyWarningScore, 55);
  if (status === "defaulted") earlyWarningScore = 100;
  const currentRiskLevel: RiskLevel =
    earlyWarningScore <= 30
      ? "low"
      : earlyWarningScore <= 60
        ? "medium"
        : "high";

  return {
    approvedAmount: input.amount,
    disbursedAmount,
    remainingUndisbursedAmount: Math.max(input.amount - disbursedAmount, 0),
    monthlyInstallment: Math.round(input.monthlyInstallment || 0),
    firstInstallmentDate,
    lastInstallmentDate,
    paymentStatus: getPaymentStatus(status),
    paidInstallments,
    remainingInstallments,
    latestFinancialUpdate: input.now.toISOString(),
    nextReviewDate,
    currentRiskLevel,
    earlyWarningScore,
    earlyWarningAlerts: alerts.length
      ? alerts
      : ["لا توجد مؤشرات تعثر حالية، مع استمرار المتابعة الشهرية."],
    earlyWarningComponents,
    earlyWarningMethodology:
      "مؤشر ديناميكي: PD التقديري 25%، DSCR بعد التمويل 30%، المديونية 15%، التدفق التشغيلي 12%، السيولة 8%، وAltman Z' بنسبة 10%.",
  };
}

function buildProtectionPlan(
  amount: number,
  risk: RiskScore,
  guaranteePlan: ReturnType<typeof buildGuaranteePlan>,
  status: FinancingJourneyStatus,
) {
  const guaranteeCoverageRatio =
    amount > 0 ? guaranteePlan.requiredAmount / amount : 0;
  const baseRecovery =
    risk.riskLevel === "low" ? 0.55 : risk.riskLevel === "medium" ? 0.4 : 0.25;
  const expectedRecoveryRate = clamp(
    baseRecovery + guaranteeCoverageRatio * 0.25,
    0.15,
    0.9,
  );
  const defaultProbability = clamp(
    risk.defaultProbability,
    1,
    status === "defaulted" ? 100 : 95,
  );
  const exposureAtDefault = Math.max(
    amount - (status === "closed" ? amount : 0),
    0,
  );
  const expectedRecoveryAmount = Math.round(
    exposureAtDefault * expectedRecoveryRate,
  );
  const expectedLoss = Math.round(
    exposureAtDefault * (defaultProbability / 100) * (1 - expectedRecoveryRate),
  );

  return {
    fundingAmount: amount,
    guaranteeValue: guaranteePlan.requiredAmount,
    guaranteeCoverageRatio,
    defaultProbability,
    expectedRecoveryRate,
    expectedRecoveryAmount,
    expectedLoss,
    exposureAtDefault,
    mitigationActions: [
      "صرف التمويل على مراحل بدل دفعة واحدة عند ارتفاع المخاطر.",
      "إيقاف الدفعات الإضافية إذا انخفضت قدرة السداد أو تأخرت الشركة في رفع بياناتها.",
      "تفعيل إعادة الجدولة مبكراً قبل الوصول إلى التعثر الكامل.",
      "استخدام الضمانات المقبولة لتقليل الخسارة عند الإفلاس أو التصفية.",
    ],
  };
}

function buildEarlyWarningAlerts(input: {
  risk: RiskScore;
  dscrAfterFinancing: number | null | undefined;
  debtRatio: number | null | undefined;
  operatingCashFlowRatio: number | null | undefined;
  currentRatio: number | null | undefined;
  zScore: number | null | undefined;
  cash: number | null | undefined;
}) {
  const alerts: string[] = [];
  const dscr = input.dscrAfterFinancing;
  if (dscr !== null && dscr !== undefined) {
    if (dscr < 1)
      alerts.push("DSCR بعد التمويل أقل من 1.00؛ قدرة السداد غير كافية.");
    else if (dscr < 1.25)
      alerts.push("DSCR بعد التمويل قريب من الحد الأدنى 1.25 ويحتاج متابعة.");
  }
  if (
    input.debtRatio !== null &&
    input.debtRatio !== undefined &&
    input.debtRatio > 0.65
  ) {
    alerts.push("نسبة المديونية مرتفعة وقد تضغط على قدرة السداد.");
  }
  if (
    input.operatingCashFlowRatio !== null &&
    input.operatingCashFlowRatio !== undefined &&
    input.operatingCashFlowRatio < 0.3
  ) {
    alerts.push("نسبة التدفق التشغيلي منخفضة مقارنة بالالتزامات المتداولة.");
  }
  if (
    input.currentRatio !== null &&
    input.currentRatio !== undefined &&
    input.currentRatio < 1
  ) {
    alerts.push("نسبة السيولة الحالية أقل من 1.00؛ رأس المال العامل تحت ضغط.");
  }
  if (input.zScore !== null && input.zScore !== undefined && input.zScore < 1.23) {
    alerts.push("Altman Z' في منطقة التعثر ويستدعي مراجعة ائتمانية فورية.");
  }
  if (input.risk.defaultProbability >= 30) {
    alerts.push("احتمال التعثر التقديري مرتفع ويستدعي ضمانات أقوى أو خفض التمويل.");
  }
  return alerts;
}

function buildEarlyWarningComponents(input: {
  risk: RiskScore;
  dscrAfterFinancing: number | null | undefined;
  debtRatio: number | null | undefined;
  operatingCashFlowRatio: number | null | undefined;
  currentRatio: number | null | undefined;
  zScore: number | null | undefined;
}) {
  const definitions = [
    {
      label: "احتمال التعثر التقديري",
      score: clamp(input.risk.defaultProbability * 2, 0, 100),
      weight: 0.25,
    },
    {
      label: "ضغط خدمة الدين DSCR",
      score: inverseRiskScore(input.dscrAfterFinancing, 0.8, 1.5),
      weight: 0.3,
    },
    {
      label: "ارتفاع المديونية",
      score: directRiskScore(input.debtRatio, 0.35, 0.75),
      weight: 0.15,
    },
    {
      label: "ضعف التدفق التشغيلي",
      score: inverseRiskScore(input.operatingCashFlowRatio, 0.1, 0.8),
      weight: 0.12,
    },
    {
      label: "ضعف السيولة",
      score: inverseRiskScore(input.currentRatio, 0.7, 1.8),
      weight: 0.08,
    },
    {
      label: "مؤشر Altman Z'",
      score: inverseRiskScore(input.zScore, 1.23, 2.9),
      weight: 0.1,
    },
  ];

  return definitions.map((component) => ({
    ...component,
    score: Math.round(component.score),
    contribution: Math.round(component.score * component.weight * 100) / 100,
  }));
}

function directRiskScore(
  value: number | null | undefined,
  safe: number,
  dangerous: number,
) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 50;
  if (value <= safe) return 0;
  if (value >= dangerous) return 100;
  return ((value - safe) / (dangerous - safe)) * 100;
}

function inverseRiskScore(
  value: number | null | undefined,
  dangerous: number,
  safe: number,
) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 50;
  if (value <= dangerous) return 100;
  if (value >= safe) return 0;
  return 100 - ((value - dangerous) / (safe - dangerous)) * 100;
}

function buildNextActions(
  status: FinancingJourneyStatus,
  monitoring: ReturnType<typeof buildMonitoringPlan>,
  guarantee: ReturnType<typeof buildGuaranteePlan>,
) {
  switch (canonicalFinancingStatus(status)) {
    case "analysis_completed":
      return [
        "إرسال طلب التمويل للبنك الشريك.",
        "مراجعة المبلغ والمدة والضمانات المقترحة قبل الإرسال.",
      ];
    case "bank_review":
      return [
        "مراجعة مستندات الشركة والملف المالي.",
        "إصدار موافقة مشروطة أو رفض مسبب.",
      ];
    case "conditional_approval":
      return [
        "طلب الضمانات المحددة قبل الصرف.",
        `قيمة الضمانات المطلوبة: ${guarantee.requiredAmount.toLocaleString("ar-SA")} ريال.`,
      ];
    case "guarantee_required":
      return [
        "استلام الضمانات وفحص قيمتها.",
        "تحديث حالة الضمانات إلى مقبولة قبل اعتماد التمويل.",
      ];
    case "approved":
      return [
        "تجهيز جدول السداد النهائي.",
        "صرف التمويل على دفعة أو مراحل حسب مستوى المخاطر.",
      ];
    case "disbursed":
    case "monitoring":
      return [
        "متابعة شهرية للقوائم المالية والسداد.",
        `المراجعة القادمة: ${new Date(monitoring.nextReviewDate).toLocaleDateString("ar-SA")}.`,
      ];
    case "warning":
      return [
        "إرسال إنذار مبكر للشركة.",
        "تجميد أي دفعات إضافية ودراسة إعادة الجدولة.",
      ];
    case "restructured":
      return [
        "متابعة الالتزام بالجدولة الجديدة.",
        "تصعيد الحالة إذا تكرر التأخر.",
      ];
    case "defaulted":
      return [
        "تفعيل إجراءات الضمانات والاسترداد.",
        "تقدير الخسارة المتوقعة وتوثيق المطالبات.",
      ];
    case "closed":
      return ["إغلاق ملف التمويل وأرشفة السجل."];
    case "rejected":
      return ["إبلاغ مقدم الطلب بسبب الرفض ومتطلبات إعادة التقديم."];
    default:
      return ["استكمال بيانات الطلب والمتطلبات الأساسية."];
  }
}

function getPaymentStatus(status: FinancingJourneyStatus) {
  switch (status) {
    case "warning":
      return "late_one_installment" as const;
    case "defaulted":
      return "defaulted" as const;
    case "restructured":
      return "restructured" as const;
    case "closed":
      return "closed" as const;
    case "disbursed":
    case "monitoring":
      return "on_time" as const;
    default:
      return "not_started" as const;
  }
}

function estimateMonthlyInstallment(
  principal: number,
  annualRatePercent: number | null | undefined,
  months: number,
) {
  if (principal <= 0 || months <= 0) return 0;
  const monthlyRate = (annualRatePercent || 0) / 100 / 12;
  if (monthlyRate === 0) return Math.round(principal / months);
  return Math.round(
    (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months)),
  );
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function positiveNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
