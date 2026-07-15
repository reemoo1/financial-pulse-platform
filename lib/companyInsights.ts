import { CompanyReportData } from "./types";

export type InsightSeverity = "high" | "medium" | "low";

export type RejectionReason = {
  reason: string;
  severity: InsightSeverity;
};

export type ImprovementRecommendation = {
  title: string;
  detail: string;
  priority: InsightSeverity;
};

export type RepaymentInstallment = {
  sequence: number;
  dueDate: string;
  principal: number;
  profit: number;
  amountDue: number;
};

export type RepaymentPlan = {
  amount: number;
  termMonths: number;
  annualRate: number;
  monthlyInstallment: number;
  firstDueDate: string;
  lastDueDate: string;
  suitability: "comfortable" | "stretched" | "high_pressure";
  suitabilityLabel: string;
  suitabilityNote: string;
  installments: RepaymentInstallment[];
};

export type SmartAlert = {
  id: string;
  tone: "info" | "warning" | "danger" | "success";
  title: string;
  message: string;
};

export type FinancingReadiness = {
  readinessScore: number;
  repaymentCapacity: number;
  suggestedAmount: number;
  riskLevel: CompanyReportData["risk"]["riskLevel"];
  requestStatus: string;
  requestStatusCode: "ready" | "conditional" | "review" | "not_ready";
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function addMonthsIso(base: string, months: number) {
  const date = new Date(base);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function riskLevelLabel(level: CompanyReportData["risk"]["riskLevel"]) {
  if (level === "low") return "منخفض";
  if (level === "medium") return "متوسط";
  return "مرتفع";
}

function eligibilityLabel(eligibility: CompanyReportData["funding"]["eligibility"]) {
  if (eligibility === "eligible") return "جاهز للتقديم";
  if (eligibility === "conditional") return "مشروط — يحتاج تحسينات";
  return "يحتاج مراجعة لجنة ائتمان";
}

export function computeFinancingReadiness(data: CompanyReportData): FinancingReadiness {
  const health = clamp(data.risk.healthScore ?? 100 - data.risk.defaultProbability, 0, 100);
  const pd = clamp(data.risk.defaultProbability, 0, 100);
  const dscr = data.ratios.dscr;
  const hasFunding = data.funding.amount > 0;
  const dataComplete = data.dataSufficiency?.coreFinancials.status === "complete";

  let readinessScore = Math.round(
    health * 0.35 +
      (hasFunding ? 25 : 0) +
      (dataComplete ? 15 : 0) +
      scoreHigher(data.ratios.currentRatio, 0.8, 2) * 0.1 +
      scoreLower(data.ratios.debtRatio, 0.35, 0.85) * 0.1 +
      (dscr != null ? scoreHigher(dscr, 1, 1.5) * 0.05 : 0),
  );
  readinessScore = clamp(readinessScore - pd * 0.15, 0, 100);

  const maxAffordable = data.funding.maxAffordableInstallment || 0;
  const estimated = data.funding.estimatedMonthlyInstallment || 0;
  const repaymentCapacity =
    maxAffordable > 0 && estimated > 0
      ? clamp(Math.round((maxAffordable / estimated) * 100), 0, 200)
      : hasFunding
        ? clamp(Math.round(health * 0.9), 0, 100)
        : 0;

  let requestStatusCode: FinancingReadiness["requestStatusCode"] = "not_ready";
  if (data.funding.eligibility === "eligible" && hasFunding) requestStatusCode = "ready";
  else if (data.funding.eligibility === "conditional") requestStatusCode = "conditional";
  else if (hasFunding) requestStatusCode = "review";

  return {
    readinessScore,
    repaymentCapacity,
    suggestedAmount: data.funding.amount,
    riskLevel: data.risk.riskLevel,
    requestStatus: eligibilityLabel(data.funding.eligibility),
    requestStatusCode,
  };
}

export function deriveRejectionReasons(data: CompanyReportData): RejectionReason[] {
  const reasons: RejectionReason[] = [];
  const dscr = data.ratios.dscr;
  const currentRatio = data.ratios.currentRatio;
  const debtRatio = data.ratios.debtRatio;
  const pd = data.risk.defaultProbability;
  const health = data.risk.healthScore ?? 100 - pd;

  if (data.funding.amount <= 0) {
    reasons.push({
      reason: "لا توجد قدرة تمويلية موجبة وفق البيانات المالية الحالية.",
      severity: "high",
    });
  }

  if (currentRatio < 1) {
    reasons.push({
      reason: "انخفاض السيولة الحالية قد يعيق خدمة الدين الجديد.",
      severity: "high",
    });
  } else if (currentRatio < 1.2) {
    reasons.push({
      reason: "السيولة الحالية ضعيفة نسبيًا وتحتاج تعزيزًا قبل التمويل.",
      severity: "medium",
    });
  }

  if (debtRatio > 0.75) {
    reasons.push({
      reason: "ارتفاع نسبة المديونية يقلل هامش الائتمان المتاح.",
      severity: "high",
    });
  } else if (debtRatio > 0.6) {
    reasons.push({
      reason: "نسبة المديونية أعلى من المستوى المريح لدى معظم الجهات التمويلية.",
      severity: "medium",
    });
  }

  if (dscr != null && dscr < 1) {
    reasons.push({
      reason: "تغطية خدمة الدين (DSCR) أقل من 1 مما يشير لضغط سداد.",
      severity: "high",
    });
  } else if (dscr != null && dscr < 1.25) {
    reasons.push({
      reason: "تغطية خدمة الدين ضعيفة وقد لا تكفي لالتزامات إضافية.",
      severity: "medium",
    });
  }

  if (pd >= 35) {
    reasons.push({
      reason: "احتمال التعثر التقديري مرتفع وفق نموذج المخاطر.",
      severity: "high",
    });
  }

  if (health < 45) {
    reasons.push({
      reason: "درجة الصحة المالية منخفضة وتتطلب معالجة قبل الموافقة.",
      severity: "high",
    });
  }

  if ((data.ratios.netProfitMargin ?? 0) < 0) {
    reasons.push({
      reason: "الشركة تسجل خسائر تشغيلية مما يضعف قدرة السداد.",
      severity: "high",
    });
  }

  const missing = data.dataSufficiency?.supplemental.missingFields || [];
  if (missing.length > 0) {
    reasons.push({
      reason: `نقص بيانات مصرفية إضافية: ${missing.slice(0, 3).join("، ")}${missing.length > 3 ? "..." : ""}.`,
      severity: "medium",
    });
  }

  if (data.funding.calculation?.bindingConstraint) {
    reasons.push({
      reason: `القيد المحدد للتمويل: ${data.funding.calculation.bindingConstraint}.`,
      severity: "medium",
    });
  }

  return reasons.slice(0, 8);
}

export function deriveImprovementRecommendations(
  data: CompanyReportData,
): ImprovementRecommendation[] {
  const items: ImprovementRecommendation[] = [];
  const dscr = data.ratios.dscr;
  const currentRatio = data.ratios.currentRatio;
  const debtRatio = data.ratios.debtRatio;
  const margin = data.ratios.netProfitMargin ?? 0;

  if (currentRatio < 1.3) {
    items.push({
      title: "تعزيز السيولة قصيرة الأجل",
      detail: "تحسين إدارة الذمم المدينة وتقليل المخزون الراكد لرفع نسبة السيولة فوق 1.3.",
      priority: currentRatio < 1 ? "high" : "medium",
    });
  }

  if (debtRatio > 0.55) {
    items.push({
      title: "خفض الاعتماد على الديون",
      detail: "إعادة جدولة الديون قصيرة الأجل أو استخدام حقوق ملكية جزئية لتخفيض نسبة المديونية.",
      priority: debtRatio > 0.7 ? "high" : "medium",
    });
  }

  if (dscr != null && dscr < 1.35) {
    items.push({
      title: "تحسين تغطية خدمة الدين",
      detail: "زيادة التدفق النقدي التشغيلي أو تقليل الالتزامات الدورية لرفع DSCR إلى 1.35 فأعلى.",
      priority: dscr < 1.1 ? "high" : "medium",
    });
  }

  if (margin < 0.08) {
    items.push({
      title: "رفع هامش الربحية",
      detail: "مراجعة هيكل التكاليف وتحسين التسعير لزيادة صافي الربح ودعم القدرة على السداد.",
      priority: margin < 0 ? "high" : "medium",
    });
  }

  if ((data.dataSufficiency?.supplemental.missingFields.length || 0) > 0) {
    items.push({
      title: "استكمال البيانات المصرفية",
      detail: "توفير كشف حساب 6 أشهر وجدول خدمة الدين لرفع دقة التقييم وتسريع المراجعة.",
      priority: "medium",
    });
  }

  if (data.funding.amount > 0 && data.funding.isPreliminary) {
    items.push({
      title: "تثبيت التمويل بعد اكتمال DSCR",
      detail: "تقديم بيانات CFADS وخدمة الدين التعاقدية لتأكيد مبلغ التمويل النهائي.",
      priority: "medium",
    });
  }

  items.push({
    title: "تجهيز حزمة ضمانات مبكرة",
    detail: "تحديد ضمانات قابلة للتقييم مسبقًا لتقليل وقت الموافقة المشروطة.",
    priority: "low",
  });

  return items.slice(0, 6);
}

export function buildRepaymentPlan(data: CompanyReportData): RepaymentPlan {
  const amount = Math.max(0, data.funding.amount);
  const termMonths = Math.max(12, data.funding.recommendedTermMonths || 36);
  const annualRate = Math.max(0, data.funding.interestRate || 0);
  const monthlyRate = annualRate / 100 / 12;
  const firstDueDate = addMonthsIso(new Date().toISOString().slice(0, 10), 1);

  const monthlyInstallment =
    monthlyRate > 0
      ? (amount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths))
      : amount / termMonths;

  let balance = amount;
  const installments: RepaymentInstallment[] = Array.from(
    { length: termMonths },
    (_, index) => {
      const profit = monthlyRate > 0 ? balance * monthlyRate : 0;
      const principal =
        index === termMonths - 1 ? balance : Math.max(0, monthlyInstallment - profit);
      balance = Math.max(0, balance - principal);
      return {
        sequence: index + 1,
        dueDate: addMonthsIso(firstDueDate, index),
        principal: Math.round(principal * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        amountDue: Math.round((principal + profit) * 100) / 100,
      };
    },
  );

  const maxAffordable = data.funding.maxAffordableInstallment || 0;
  const estimated = Math.round(monthlyInstallment * 100) / 100;
  let suitability: RepaymentPlan["suitability"] = "comfortable";
  let suitabilityLabel = "مناسبة";
  let suitabilityNote =
    "القسط الشهري ضمن القدرة التقديرية على السداد وفق البيانات الحالية.";

  if (maxAffordable > 0) {
    const ratio = estimated / maxAffordable;
    if (ratio > 1.1) {
      suitability = "high_pressure";
      suitabilityLabel = "قد تسبب ضغطًا ماليًا";
      suitabilityNote =
        "القسط الشهري يتجاوز الحد الآمن للقدرة على السداد؛ يُنصح بتقليل المبلغ أو تمديد المدة.";
    } else if (ratio > 0.85) {
      suitability = "stretched";
      suitabilityLabel = "مقبولة مع مراقبة";
      suitabilityNote =
        "القسط قريب من الحد الأعلى للقدرة على السداد؛ يُفضل متابعة السيولة شهريًا.";
    }
  } else if (data.ratios.dscr != null && data.ratios.dscr < 1.2) {
    suitability = "stretched";
    suitabilityLabel = "مقبولة مع مراقبة";
    suitabilityNote = "تغطية الدين الحالية ضعيفة؛ راقب السيولة بعد الصرف.";
  }

  return {
    amount,
    termMonths,
    annualRate,
    monthlyInstallment: estimated,
    firstDueDate,
    lastDueDate: installments[installments.length - 1]?.dueDate || firstDueDate,
    suitability,
    suitabilityLabel,
    suitabilityNote,
    installments,
  };
}

export function buildPerformanceComparison(data: CompanyReportData) {
  const afterDscr = data.funding.dscrAfterFinancing ?? data.ratios.dscr;
  const debtAfter =
    data.ratios.debtRatio != null && data.financials.totalAssets
      ? clamp(
          (data.financials.totalAssets * data.ratios.debtRatio + data.funding.amount) /
            Math.max(1, data.financials.totalAssets),
          0,
          1.5,
        )
      : data.ratios.debtRatio;

  return {
    before: {
      dscr: data.ratios.dscr,
      debtRatio: data.ratios.debtRatio,
      currentRatio: data.ratios.currentRatio,
      healthScore: data.risk.healthScore ?? 100 - data.risk.defaultProbability,
      cashFlowRatio: data.ratios.operatingCashFlowRatio,
    },
    after: {
      dscr: afterDscr,
      debtRatio: debtAfter,
      currentRatio: data.ratios.currentRatio,
      healthScore: clamp(
        (data.risk.healthScore ?? 70) - (data.funding.amount > 0 ? 5 : 0),
        0,
        100,
      ),
      cashFlowRatio: data.ratios.operatingCashFlowRatio,
    },
    fundingAmount: data.funding.amount,
    monthlyInstallment: data.funding.estimatedMonthlyInstallment,
  };
}

export function buildCompanyAlerts(data: CompanyReportData): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  const readiness = computeFinancingReadiness(data);

  if (readiness.readinessScore >= 75 && data.funding.amount > 0) {
    alerts.push({
      id: "ready",
      tone: "success",
      title: "جاهزية تمويل جيدة",
      message: `نسبة الجاهزية ${readiness.readinessScore}% — يمكنك تقديم طلب التمويل.`,
    });
  }

  if (data.funding.amount <= 0) {
    alerts.push({
      id: "no-funding",
      tone: "danger",
      title: "لا يوجد تمويل مقترح",
      message: "البيانات الحالية لا تدعم تمويلًا آليًا؛ راجع أسباب الرفض والتوصيات.",
    });
  }

  if (data.funding.isPreliminary) {
    alerts.push({
      id: "preliminary",
      tone: "warning",
      title: "تقدير أولي",
      message: "مبلغ التمويل قابل للتغيير بعد اكتمال DSCR ومراجعة البنك.",
    });
  }

  const lateRisk = deriveRejectionReasons(data).filter((r) => r.severity === "high");
  if (lateRisk.length >= 2) {
    alerts.push({
      id: "risk-high",
      tone: "warning",
      title: "مؤشرات مخاطر متعددة",
      message: `${lateRisk.length} عوامل قد تؤثر على قرار التمويل — راجع التوصيات.`,
    });
  }

  if ((data.dataSufficiency?.supplemental.missingFields.length || 0) > 0) {
    alerts.push({
      id: "missing-data",
      tone: "info",
      title: "بيانات إضافية مطلوبة",
      message: "استكمال البيانات المصرفية يرفع دقة التقييم وفرص الموافقة.",
    });
  }

  return alerts.slice(0, 5);
}

export function buildInquiryAlerts(input: {
  requestStatusCode: string;
  totalDisbursed?: number;
  remainingUndisbursed?: number;
  nextInstallmentDue?: string;
  nextInstallmentAmount?: number;
  daysPastDue?: number;
  monitoringAlerts?: string[];
  nextSubmissionDate?: string | null;
  decision?: string | null;
}): SmartAlert[] {
  const alerts: SmartAlert[] = [];

  if (input.decision === "rejected") {
    alerts.push({
      id: "rejected",
      tone: "danger",
      title: "تم رفض الطلب",
      message: "راجع سجل الطلب أو تواصل مع الجهة التمويلية لمعرفة التفاصيل.",
    });
  }

  if ((input.totalDisbursed || 0) > 0 && (input.remainingUndisbursed || 0) > 0) {
    alerts.push({
      id: "partial-disbursement",
      tone: "info",
      title: "صرف جزئي",
      message: `تم صرف جزء من التمويل؛ المتبقي ${formatMoney(input.remainingUndisbursed || 0)}.`,
    });
  }

  if ((input.daysPastDue || 0) > 0) {
    alerts.push({
      id: "late",
      tone: "danger",
      title: "تأخر في السداد",
      message: `يوجد قسط متأخر ${input.daysPastDue} يومًا — يُنصح بالسداد فورًا.`,
    });
  }

  if (input.nextInstallmentDue && input.nextInstallmentAmount) {
    alerts.push({
      id: "next-installment",
      tone: "info",
      title: "القسط القادم",
      message: `قسط بقيمة ${formatMoney(input.nextInstallmentAmount)} مستحق في ${formatDateOnly(input.nextInstallmentDue)}.`,
    });
  }

  if (input.nextSubmissionDate && new Date(input.nextSubmissionDate).getTime() < Date.now()) {
    alerts.push({
      id: "monitoring-overdue",
      tone: "warning",
      title: "تجاوز موعد المتابعة",
      message: "تجاوزت موعد رفع القوائم أو كشف الحساب الدوري.",
    });
  }

  for (const alert of input.monitoringAlerts || []) {
    alerts.push({
      id: `mon-${alert.slice(0, 12)}`,
      tone: "warning",
      title: "تنبيه مالي",
      message: alert,
    });
  }

  return alerts.slice(0, 6);
}

export function buildBankPortfolioAlerts(input: {
  newRequests: number;
  highRiskRequests: number;
  activeFinancings: number;
  averagePd: number;
}): SmartAlert[] {
  const alerts: SmartAlert[] = [];

  if (input.newRequests > 0) {
    alerts.push({
      id: "new-requests",
      tone: "info",
      title: "طلبات جديدة بانتظار المراجعة",
      message: `${input.newRequests} طلبًا يحتاج متابعة فريق الائتمان.`,
    });
  }

  if (input.highRiskRequests > 0) {
    alerts.push({
      id: "high-risk",
      tone: "warning",
      title: "تركيز مخاطر",
      message: `${input.highRiskRequests} طلبًا عالي المخاطر يحتاج تصعيدًا أو مراجعة إضافية.`,
    });
  }

  if (input.averagePd >= 25) {
    alerts.push({
      id: "portfolio-pd",
      tone: "danger",
      title: "ارتفاع التعثر المتوقع",
      message: `متوسط احتمال التعثر في المحفظة ${input.averagePd.toFixed(1)}% — راجع قائمة الأولوية.`,
    });
  }

  if (input.activeFinancings > 0) {
    alerts.push({
      id: "active",
      tone: "success",
      title: "تمويلات نشطة",
      message: `${input.activeFinancings} تمويلًا قيد المتابعة والصرف.`,
    });
  }

  return alerts.slice(0, 5);
}

export function riskLevelLabelAr(level: CompanyReportData["risk"]["riskLevel"]) {
  return riskLevelLabel(level);
}

function scoreHigher(value: number, weak: number, strong: number) {
  return clamp(((value - weak) / (strong - weak)) * 100, 0, 100);
}

function scoreLower(value: number, strong: number, weak: number) {
  return clamp(((weak - value) / (weak - strong)) * 100, 0, 100);
}

function formatMoney(value: number) {
  return `${value.toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ر.س`;
}

function formatDateOnly(value: string) {
  return new Date(value).toLocaleDateString("ar-SA");
}
