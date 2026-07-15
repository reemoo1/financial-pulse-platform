import { CompanyReportData, StartupReportData } from "./types";

export type AiCreditDecision = "approve" | "conditional" | "reject" | "manual_review";
export interface AiCreditRecommendation {
  decision: AiCreditDecision;
  confidence: number;
  recommendedAmount: number;
  recommendedRate: number;
  recommendedTermMonths: number;
  conditions: string[];
  riskRecommendation: string;
  rationale: string[];
  warnings: string[];
  modelStatus: "deterministic" | "limited_data";
  modelVersion: string;
  scorecard: {
    dataQuality: number;
    capacity: number;
    financialStrength: number;
    leverage: number;
    liquidity: number;
    risk: number;
    collateral: number;
    overall: number;
  };
  reviewReasons: string[];
}
export interface AiCreditContext {
  applicantName: string;
  requestedAmount: number;
  requestedTermMonths: number;
  collateralReady: boolean;
  earlyWarningScore?: number;
  company?: CompanyReportData | null;
  startup?: StartupReportData | null;
}

const MODEL_VERSION = "credit-decision-v2.1-safe-hybrid";
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const roundDown = (v: number, step = 50_000) => !Number.isFinite(v) || v <= 0 ? 0 : Math.floor(v / step) * step;
const n = (v: unknown, fallback = 0) => typeof v === "number" && Number.isFinite(v) ? v : fallback;
const scoreHigher = (value: number, weak: number, strong: number) => clamp(((value - weak) / (strong - weak)) * 100, 0, 100);
const scoreLower = (value: number, strong: number, weak: number) => clamp(((weak - value) / (weak - strong)) * 100, 0, 100);
const uniq = (items: string[]) => [...new Set(items.filter(Boolean))];

function emptyRecommendation(c: AiCreditContext, reason: string): AiCreditRecommendation {
  return {
    decision: "manual_review", confidence: 15, recommendedAmount: 0, recommendedRate: 0,
    recommendedTermMonths: clamp(Math.round(n(c.requestedTermMonths, 36)), 12, 84),
    conditions: ["استكمال التقرير المالي ودراسة الطلب يدويًا قبل أي قرار."],
    riskRecommendation: "إيقاف القرار الآلي وإحالة الطلب للمراجعة اليدوية لعدم كفاية البيانات.",
    rationale: [reason], warnings: ["لا توجد بيانات كافية لإصدار توصية قابلة للاعتماد."],
    modelStatus: "limited_data", modelVersion: MODEL_VERSION,
    scorecard: { dataQuality: 0, capacity: 0, financialStrength: 0, leverage: 0, liquidity: 0, risk: 0, collateral: 0, overall: 0 },
    reviewReasons: [reason],
  };
}

export function buildAiCreditRecommendation(c: AiCreditContext): AiCreditRecommendation {
  const { company, startup } = c;
  const warnings: string[] = [];
  const conditions: string[] = [];
  const rationale: string[] = [];
  const reviewReasons: string[] = [];

  if (!company && !startup) return emptyRecommendation(c, "لا توجد بيانات تحليلية مالية أو دراسة جدوى.");

  if (startup) {
    const success = clamp(n(startup.successProbability), 0, 100);
    const feasible = Boolean(startup.feasible);
    const amount = roundDown(Math.min(n(c.requestedAmount), n(startup.recommendedCapital, n(c.requestedAmount))));
    let decision: AiCreditDecision = feasible && success >= 75 ? "conditional" : "manual_review";
    if (success < 50 || !feasible) decision = "reject";
    const confidence = clamp(Math.round(35 + success * 0.35), 35, 72);
    conditions.push("صرف التمويل على مراحل مرتبطة بمعالم تشغيلية قابلة للتحقق.", "تقديم مساهمة ذاتية موثقة.", "رفع تدفقات نقدية شهرية خلال أول 18 شهرًا.", "استكمال واعتماد الضمانات قبل الصرف.");
    rationale.push(`احتمال النجاح التقديري ${success.toFixed(0)}%.`, `رأس المال المقترح ${amount.toLocaleString("ar-SA")} ريال.`);
    warnings.push("دراسة المنشآت الناشئة تعتمد على افتراضات مستقبلية ولا تعد بديلاً عن التحقق الميداني.");
    return {
      decision, confidence, recommendedAmount: amount, recommendedRate: 0,
      recommendedTermMonths: clamp(Math.min(n(c.requestedTermMonths, 36), Math.max(12, n(startup.paybackMonths, 36))), 12, 60),
      conditions, riskRecommendation: decision === "reject" ? "المخاطر مرتفعة؛ يوصى بعدم التمويل بصيغته الحالية." : "صرف مرحلي مع مراجعة شهرية للسيولة والانحراف عن خطة العمل.",
      rationale, warnings, modelStatus: "limited_data", modelVersion: MODEL_VERSION,
      scorecard: { dataQuality: 45, capacity: success, financialStrength: success, leverage: 50, liquidity: 50, risk: success, collateral: c.collateralReady ? 100 : 25, overall: Math.round(success * 0.7 + (c.collateralReady ? 30 : 8)) },
      reviewReasons: decision === "manual_review" ? ["نتيجة المنشأة الناشئة قريبة من حدود القرار أو تحتاج تحققًا ميدانيًا."] : [],
    };
  }

  const health = clamp(n(company.risk.healthScore), 0, 100);
  const pd = clamp(n(company.risk.defaultProbability, 100), 0, 100);
  const dscr = company.ratios.dscr;
  const currentRatio = n(company.ratios.currentRatio);
  const debtRatio = n(company.ratios.debtRatio);
  const netMargin = n(company.ratios.netProfitMargin);
  const interestCoverage = company.ratios.interestCoverage;
  const warningScore = clamp(n(c.earlyWarningScore), 0, 100);
  const requestedAmount = Math.max(0, n(c.requestedAmount));
  const fundingLimit = Math.max(0, n(company.funding.amount));

  const dataComplete = company.dataSufficiency?.coreFinancials.status === "complete";
  const missingBankInputs = company.dataSufficiency?.supplemental?.missingFields?.length ?? 0;
  const altmanAccurate = company.dataSufficiency?.altman?.isAccurate ?? false;
  const dscrReliable = dscr != null && Number.isFinite(dscr) && company.ratios.dscrMethod !== "unavailable";
  const modelValidated = company.risk.modelStatus === "validated" && company.risk.regulatoryUseAllowed === true;

  if (!dataComplete) reviewReasons.push("البيانات المالية الأساسية الإلزامية غير مكتملة.");
  if (!dscrReliable) reviewReasons.push("DSCR غير متاح أو غير محسوب من خدمة دين تعاقدية موثوقة.");
  if (requestedAmount <= 0) reviewReasons.push("مبلغ التمويل المطلوب غير صالح.");
  if (fundingLimit <= 0) reviewReasons.push("لم ينتج المحرك المالي حدًا تمويليًا موجبًا.");
  if (missingBankInputs > 0) warnings.push("بعض مدخلات CFADS وخدمة الدين غير متوفرة؛ تم تخفيض الثقة.");
  if (!altmanAccurate) warnings.push("Altman Z' غير متاح بدقة لعدم توفر جميع مدخلاته.");
  if (company.vision2030.details?.isEstimated) warnings.push("تحليل رؤية 2030 تقديري ولا يدخل في قرار القبول الأساسي.");
  if (!modelValidated) warnings.push("احتمال التعثر نموذج تقديري غير معتمد رقابيًا؛ يستخدم كعامل مساعد فقط.");

  // كشف التناقضات التي قد تشير إلى خطأ إدخال أو اختلاف فترة مالية.
  if (health >= 80 && pd >= 30) reviewReasons.push("تعارض بين درجة الصحة العالية واحتمال التعثر المرتفع.");
  if (dscrReliable && dscr! >= 1.5 && pd >= 35) reviewReasons.push("تعارض بين تغطية الدين الجيدة واحتمال التعثر المرتفع.");
  if (debtRatio < 0 || debtRatio > 1.5) reviewReasons.push("نسبة المديونية خارج نطاق منطقي وتحتاج مراجعة المصدر.");
  if (currentRatio < 0 || currentRatio > 20) reviewReasons.push("نسبة السيولة خارج نطاق منطقي وتحتاج مراجعة المصدر.");

  const dataQuality = clamp((dataComplete ? 55 : 0) + (dscrReliable ? 25 : 0) + (missingBankInputs === 0 ? 10 : 0) + (altmanAccurate ? 5 : 0) + (modelValidated ? 5 : 0), 0, 100);
  const capacity = dscrReliable ? scoreHigher(dscr!, 0.9, 1.75) : 0;
  const financialStrength = clamp(health * 0.65 + scoreHigher(netMargin, 0, 0.15) * 0.35, 0, 100);
  const leverage = scoreLower(debtRatio, 0.35, 0.85);
  const liquidity = scoreHigher(currentRatio, 0.8, 2.0);
  const risk = scoreLower(pd, 5, 40);
  const collateral = c.collateralReady ? 100 : 30;
  const overall = Math.round(dataQuality * 0.18 + capacity * 0.24 + financialStrength * 0.18 + leverage * 0.12 + liquidity * 0.10 + risk * 0.14 + collateral * 0.04);

  // قواعد رفض صلبة لا تتجاوزها الدرجة المجمعة.
  const hardReject = dataComplete && dscrReliable && (
    pd >= 45 || health < 35 || dscr! < 0.9 || debtRatio > 0.9 ||
    (netMargin < -0.15 && currentRatio < 0.8) || warningScore >= 85
  );

  // منطقة عدم يقين حول الحدود؛ القرار الآلي يمتنع بدل المجازفة.
  const nearBoundary = dscrReliable && (
    Math.abs(dscr! - 1.0) <= 0.05 || Math.abs(dscr! - 1.25) <= 0.05 || Math.abs(dscr! - 1.35) <= 0.05 ||
    Math.abs(pd - 10) <= 1 || Math.abs(pd - 35) <= 2 || Math.abs(health - 45) <= 3 || Math.abs(debtRatio - 0.65) <= 0.02
  );
  if (nearBoundary) reviewReasons.push("المؤشرات قريبة من حدود السياسة؛ يلزم تحقق بشري لتجنب قرار حدّي خاطئ.");

  let decision: AiCreditDecision;
  if (reviewReasons.some(x => x.includes("تعارض") || x.includes("خارج نطاق"))) decision = "manual_review";
  else if (hardReject) decision = "reject";
  else if (reviewReasons.length > 0 || warningScore >= 60 || dataQuality < 75) decision = "manual_review";
  else if (overall >= 78 && pd <= 12 && dscr! >= 1.35 && health >= 72 && debtRatio <= 0.68 && currentRatio >= 1.15) decision = c.collateralReady ? "approve" : "conditional";
  else if (overall >= 58 && pd <= 30 && dscr! >= 1.1 && health >= 50 && debtRatio <= 0.8) decision = "conditional";
  else decision = "reject";

  // المبلغ لا يتجاوز الأقل بين المطلوب والحد المحسوب، مع تخفيض تحفظي للحالات المشروطة.
  let recommendedAmount = roundDown(Math.min(requestedAmount, fundingLimit));
  if (decision === "conditional") recommendedAmount = roundDown(recommendedAmount * 0.9);
  if (decision === "reject" || decision === "manual_review") recommendedAmount = decision === "manual_review" ? recommendedAmount : 0;

  if (!c.collateralReady) conditions.push("استكمال واعتماد وتوثيق حزمة الضمانات قبل أي صرف.");
  if (dscrReliable && dscr! < 1.5) conditions.push("المحافظة على DSCR لا يقل عن 1.25 وإرسال اختبار تعهد دوري.");
  if (debtRatio > 0.6) conditions.push("عدم الحصول على تمويل إضافي أو توزيع أرباح جوهري دون موافقة البنك.");
  if (currentRatio < 1.3) conditions.push("تقديم كشف سيولة وتدفقات نقدية شهري خلال أول 12 شهرًا.");
  if (netMargin < 0.05) conditions.push("تقديم خطة تحسين ربحية ومراقبة الانحراف عن الميزانية ربع سنويًا.");
  if (warningScore >= 35) conditions.push("إدراج العميل في قائمة المراقبة وتحديث المؤشرات شهريًا.");
  conditions.push("استخدام التمويل للغرض المعتمد فقط مع حق البنك في التحقق من أوجه الصرف.", "تزويد البنك بالقوائم المالية وسجل السداد وفق خطة المتابعة.");

  rationale.push(
    `النتيجة الائتمانية المجمعة ${overall} من 100.`,
    `درجة الصحة المالية ${health.toFixed(0)} من 100.`,
    `احتمال التعثر التقديري ${pd.toFixed(1)}%.`,
    dscrReliable ? `DSCR يبلغ ${dscr!.toFixed(2)} مرة.` : "DSCR غير متاح بدقة.",
    `المديونية ${(debtRatio * 100).toFixed(1)}% والسيولة ${currentRatio.toFixed(2)} مرة.`,
    `الحد التمويلي الآمن المقترح ${recommendedAmount.toLocaleString("ar-SA")} ريال.`
  );

  let riskRecommendation = "إحالة الطلب للمراجعة اليدوية قبل اتخاذ القرار.";
  if (decision === "approve") riskRecommendation = "المخاطر مقبولة ضمن الحدود الحالية، مع متابعة ربع سنوية وإعادة تقييم الضمانات دوريًا.";
  if (decision === "conditional") riskRecommendation = "موافقة مشروطة بتخفيف المخاطر عبر الضمانات والتعهدات ومراقبة السيولة وDSCR.";
  if (decision === "reject") riskRecommendation = "المخاطر تتجاوز شهية القبول الحالية؛ يوصى بالرفض أو إعادة هيكلة الطلب بعد تحسن المؤشرات.";

  const boundaryPenalty = nearBoundary ? 18 : 0;
  const contradictionPenalty = reviewReasons.filter(x => x.includes("تعارض") || x.includes("خارج نطاق")).length * 12;
  let confidence = Math.round(45 + dataQuality * 0.3 + Math.abs(overall - 65) * 0.25 - boundaryPenalty - contradictionPenalty);
  if (decision === "manual_review") confidence = Math.min(confidence, 64);
  if (!modelValidated) confidence -= 6;
  confidence = clamp(confidence, 20, 94);

  return {
    decision, confidence, recommendedAmount,
    recommendedRate: n(company.funding.interestRate),
    recommendedTermMonths: clamp(Math.round(n(c.requestedTermMonths, company.funding.recommendedTermMonths ?? 36)), 12, 84),
    conditions: uniq(conditions).slice(0, 10), riskRecommendation,
    rationale: uniq(rationale), warnings: uniq(warnings),
    modelStatus: dataQuality >= 90 && modelValidated ? "deterministic" : "limited_data",
    modelVersion: MODEL_VERSION,
    scorecard: { dataQuality: Math.round(dataQuality), capacity: Math.round(capacity), financialStrength: Math.round(financialStrength), leverage: Math.round(leverage), liquidity: Math.round(liquidity), risk: Math.round(risk), collateral: Math.round(collateral), overall },
    reviewReasons: uniq(reviewReasons),
  };
}
