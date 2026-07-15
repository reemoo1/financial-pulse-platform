import { v4 as uuidv4 } from "uuid";
import { COLLATERAL_POLICY, COLLATERAL_POLICY_VERSION, requiredCollateralCoverageRatio as calculateRequiredCollateralCoverageRatio } from "./collateralPolicy";
import {
  CollateralAsset,
  CollateralDocument,
  CollateralPackage,
  CollateralPackageStatus,
  CollateralRecommendationOption,
  CollateralType,
  CompanyReportData,
  FinancingLifecyclePlan,
  FinancingRequestRecord,
  RiskLevel,
  StartupReportData,
} from "./types";

export const COLLATERAL_MODEL_VERSION = "COLLATERAL-3.0.0";

export const COLLATERAL_CATALOG: Record<
  CollateralType,
  {
    label: string;
    haircut: number;
    maximumCoverageShare: number;
    documents: string[];
    caveats: string[];
    defaultChecks: Array<keyof CollateralAsset["checks"]>;
  }
> = {
  cash_deposit: {
    label: "وديعة نقدية محجوزة",
    haircut: COLLATERAL_POLICY.haircuts.cash_deposit,
    maximumCoverageShare: 1,
    documents: ["خطاب حجز الوديعة", "كشف الحساب", "تفويض الخصم"],
    caveats: [
      "يجب أن تكون الوديعة خالية من حقوق الغير ومجمدة لصالح جهة التمويل.",
    ],
    defaultChecks: [
      "ownershipVerified",
      "encumbranceChecked",
      "legalPerfectionVerified",
    ],
  },
  bank_guarantee: {
    label: "ضمان بنكي غير مشروط",
    haircut: COLLATERAL_POLICY.haircuts.bank_guarantee,
    maximumCoverageShare: 1,
    documents: ["أصل خطاب الضمان", "التحقق من البنك المصدر", "شروط المطالبة"],
    caveats: [
      "تُراجع صلاحية البنك المصدر وتاريخ انتهاء الضمان وشروط المطالبة.",
    ],
    defaultChecks: [
      "ownershipVerified",
      "encumbranceChecked",
      "legalPerfectionVerified",
    ],
  },
  kafalah: {
    label: "تغطية برنامج كفالة",
    haircut: COLLATERAL_POLICY.haircuts.kafalah,
    maximumCoverageShare: 0.8,
    documents: ["موافقة برنامج كفالة", "شهادة التغطية", "جدول حدود المطالبة"],
    caveats: ["القيمة النهائية مرتبطة بموافقة البرنامج وشروط التغطية الفعلية."],
    defaultChecks: ["ownershipVerified", "legalPerfectionVerified"],
  },
  real_estate: {
    label: "رهن عقاري",
    haircut: COLLATERAL_POLICY.haircuts.real_estate,
    maximumCoverageShare: 1,
    documents: [
      "صك الملكية",
      "تقييم مستقل حديث",
      "شهادة خلو الرهن",
      "وثيقة التأمين",
      "إثبات تسجيل الرهن",
    ],
    caveats: [
      "لا يعتمد إلا بعد التقييم المستقل والتحقق من الملكية والمرتبة وتسجيل الرهن.",
    ],
    defaultChecks: [
      "ownershipVerified",
      "encumbranceChecked",
      "valuationVerified",
      "insuranceVerified",
      "legalPerfectionVerified",
    ],
  },
  equipment: {
    label: "رهن معدات وآلات",
    haircut: COLLATERAL_POLICY.haircuts.equipment,
    maximumCoverageShare: 0.6,
    documents: [
      "فواتير الشراء",
      "قائمة الأصول",
      "تقييم مستقل",
      "أرقام تسلسلية",
      "وثيقة التأمين",
      "عقد الرهن",
    ],
    caveats: [
      "تتأثر القيمة بسرعة التقادم وقابلية البيع وتكاليف النقل والتخزين.",
    ],
    defaultChecks: [
      "ownershipVerified",
      "encumbranceChecked",
      "valuationVerified",
      "insuranceVerified",
      "legalPerfectionVerified",
    ],
  },
  vehicle: {
    label: "رهن مركبات تشغيلية",
    haircut: COLLATERAL_POLICY.haircuts.vehicle,
    maximumCoverageShare: 0.4,
    documents: [
      "استمارات المركبات",
      "تقييم حديث",
      "وثائق التأمين",
      "إثبات تسجيل الرهن",
    ],
    caveats: [
      "تُستبعد المركبات المرهونة أو عالية الاستهلاك، وتُحدّث القيمة دورياً.",
    ],
    defaultChecks: [
      "ownershipVerified",
      "encumbranceChecked",
      "valuationVerified",
      "insuranceVerified",
      "legalPerfectionVerified",
    ],
  },
  inventory: {
    label: "رهن مخزون",
    haircut: COLLATERAL_POLICY.haircuts.inventory,
    maximumCoverageShare: 0.4,
    documents: [
      "كشف مخزون حديث",
      "تقادم المخزون",
      "وثيقة التأمين",
      "تقرير جرد",
      "اتفاقية رقابة على المخزون",
    ],
    caveats: [
      "لا يعتمد المخزون بطيء الحركة أو سريع التلف، ويلزم جرد ورقابة دورية.",
    ],
    defaultChecks: [
      "ownershipVerified",
      "encumbranceChecked",
      "valuationVerified",
      "insuranceVerified",
      "legalPerfectionVerified",
    ],
  },
  receivables: {
    label: "حوالة حقوق ومستحقات",
    haircut: COLLATERAL_POLICY.haircuts.receivables,
    maximumCoverageShare: 0.6,
    documents: [
      "أعمار الذمم",
      "العقود والفواتير",
      "إشعارات المدينين",
      "اتفاقية الحوالة",
      "حساب تحصيل محكوم",
    ],
    caveats: ["تُستبعد الذمم المتأخرة والمتنازع عليها والمركزة لدى عميل واحد."],
    defaultChecks: [
      "ownershipVerified",
      "encumbranceChecked",
      "valuationVerified",
      "legalPerfectionVerified",
    ],
  },
  corporate_guarantee: {
    label: "ضمان شركة أم أو طرف مؤسسي",
    haircut: COLLATERAL_POLICY.haircuts.corporate_guarantee,
    maximumCoverageShare: 0.4,
    documents: [
      "قرار مجلس الإدارة",
      "القوائم المالية للضامن",
      "اتفاقية الضمان",
      "التحقق من الصلاحيات",
    ],
    caveats: [
      "تعتمد القيمة على الجدارة الائتمانية المستقلة للضامن وقابليته القانونية للضمان.",
    ],
    defaultChecks: [
      "ownershipVerified",
      "valuationVerified",
      "legalPerfectionVerified",
    ],
  },
  personal_guarantee: {
    label: "ضمان شخصي محدود",
    haircut: COLLATERAL_POLICY.haircuts.personal_guarantee,
    maximumCoverageShare: 0.2,
    documents: [
      "هوية الضامن",
      "إقرار الذمة المالية",
      "اتفاقية الضمان",
      "التحقق من الملاءة",
    ],
    caveats: [
      "لا يُعتمد وحده لتغطية التمويل، وتُقيّم ملاءة الضامن بصورة مستقلة.",
    ],
    defaultChecks: [
      "ownershipVerified",
      "valuationVerified",
      "legalPerfectionVerified",
    ],
  },
  promissory_note: {
    label: "سند لأمر",
    haircut: COLLATERAL_POLICY.haircuts.promissory_note,
    maximumCoverageShare: 0,
    documents: ["السند الموقع", "التحقق من المفوض بالتوقيع", "مرجع الحفظ"],
    caveats: [
      "أداة توثيق ومطالبة، ولا تُحتسب كقيمة ضمان مؤهلة قابلة للاسترداد.",
    ],
    defaultChecks: ["ownershipVerified", "legalPerfectionVerified"],
  },
};

export const COLLATERAL_DOCUMENT_POLICY: Record<
  CollateralType,
  {
    approval: CollateralDocument["type"][];
    perfection: CollateralDocument["type"][];
  }
> = {
  cash_deposit: { approval: ["ownership"], perfection: ["registration"] },
  bank_guarantee: { approval: ["guarantee_letter"], perfection: [] },
  kafalah: { approval: ["guarantee_letter"], perfection: [] },
  real_estate: {
    approval: ["ownership", "valuation", "insurance"],
    perfection: ["registration"],
  },
  equipment: {
    approval: ["ownership", "valuation", "insurance"],
    perfection: ["registration"],
  },
  vehicle: {
    approval: ["ownership", "valuation", "insurance"],
    perfection: ["registration"],
  },
  inventory: {
    approval: ["ownership", "valuation", "insurance"],
    perfection: ["registration"],
  },
  receivables: {
    approval: ["ownership", "valuation"],
    perfection: ["assignment"],
  },
  corporate_guarantee: {
    approval: ["financial_statement", "guarantee_letter"],
    perfection: [],
  },
  personal_guarantee: {
    approval: ["financial_statement", "guarantee_letter"],
    perfection: [],
  },
  promissory_note: { approval: ["promissory_note"], perfection: [] },
};

export function collateralDocumentRequirements(
  type: CollateralType,
  phase: "approval" | "perfection" | "all" = "all",
) {
  const policy = COLLATERAL_DOCUMENT_POLICY[type];
  if (phase === "approval") return policy.approval;
  if (phase === "perfection") return policy.perfection;
  return Array.from(new Set([...policy.approval, ...policy.perfection]));
}

export interface CollateralContext {
  approvedFinancingAmount: number;
  applicantName: string;
  applicantType: "company" | "startup";
  sector: string;
  riskLevel: RiskLevel;
  defaultProbability: number;
  dscr?: number | null;
  debtRatio?: number | null;
  company?: CompanyReportData | null;
  startup?: StartupReportData | null;
}

export function requiredCollateralCoverageRatio(context: CollateralContext) {
  return calculateRequiredCollateralCoverageRatio({
    riskLevel: context.riskLevel,
    defaultProbability: context.defaultProbability,
    dscr: context.dscr,
    debtRatio: context.debtRatio,
    applicantType: context.applicantType,
  });
}

export function buildCollateralRecommendations(
  context: CollateralContext,
): CollateralRecommendationOption[] {
  const amount = Math.max(context.approvedFinancingAmount, 0);
  const f = context.company?.financials;
  const cash = positive(f?.cash);
  const receivables = positive(f?.accountsReceivable);
  const inventory = positive(f?.inventory);
  const totalAssets = positive(f?.totalAssets);
  const currentAssets = positive(f?.currentAssets);
  const fixedAssetEstimate = Math.max(totalAssets - currentAssets, 0);
  const sector = context.sector.toLowerCase();
  const assetHeavy =
    /صناع|تصنيع|مقاول|نقل|لوجست|زراع|طاقة|construction|manufact|logistic|transport/.test(
      sector,
    );
  const recurringContracts =
    /تقنية|خدمات|صحة|تعليم|تجزئة|technology|service|health|education|retail/.test(
      sector,
    );

  const options: CollateralRecommendationOption[] = [];
  const add = (
    type: CollateralType,
    score: number,
    estimatedAvailableValue: number,
    mandatory: boolean,
    reasons: string[],
  ) => {
    const cfg = COLLATERAL_CATALOG[type];
    const eligible = estimatedAvailableValue * (1 - cfg.haircut);
    options.push({
      type,
      label: cfg.label,
      suitabilityScore: Math.round(clamp(score, 0, 100)),
      estimatedAvailableValue: Math.round(Math.max(estimatedAvailableValue, 0)),
      expectedHaircut: cfg.haircut,
      estimatedEligibleValue: Math.round(Math.max(eligible, 0)),
      maximumCoverageShare: cfg.maximumCoverageShare,
      mandatory,
      reasons,
      requiredDocuments: cfg.documents,
      caveats: cfg.caveats,
    });
  };

  add("promissory_note", 100, amount, true, [
    "يوثق الالتزام ويُطلب كشرط أساسي قبل الصرف.",
  ]);
  if (cash > 0)
    add(
      "cash_deposit",
      55 + Math.min(35, (cash / Math.max(amount, 1)) * 40),
      Math.min(cash * 0.25, amount),
      false,
      [
        "توفر الشركة رصيداً نقدياً يمكن تخصيص جزء منه كوديعة محجوزة.",
        "أعلى أنواع الضمان جودة وأقلها خصماً.",
      ],
    );
  if (receivables > 0)
    add(
      "receivables",
      58 +
        Math.min(30, (receivables / Math.max(amount, 1)) * 30) +
        (recurringContracts ? 8 : 0),
      Math.min(receivables * 0.7, amount),
      false,
      [
        "وجود ذمم مدينة أو مستحقات يمكن حوالتها إلى حساب تحصيل محكوم.",
        recurringContracts
          ? "طبيعة القطاع تدعم التدفقات التعاقدية المتكررة."
          : "يلزم تحليل أعمار الذمم وتركيز العملاء.",
      ],
    );
  if (inventory > 0)
    add(
      "inventory",
      45 + Math.min(30, (inventory / Math.max(amount, 1)) * 25),
      Math.min(inventory * 0.6, amount),
      false,
      [
        "توفر مخزون يمكن رهنه بعد استبعاد البطيء والمتقادم.",
        "يحتاج جرداً وتأميناً ورقابة دورية.",
      ],
    );
  if (fixedAssetEstimate > 0)
    add(
      "equipment",
      (assetHeavy ? 76 : 58) +
        Math.min(15, (fixedAssetEstimate / Math.max(amount, 1)) * 10),
      Math.min(fixedAssetEstimate * 0.35, amount * 1.25),
      false,
      [
        assetHeavy
          ? "القطاع كثيف الأصول والمعدات، ما يرفع ملاءمة رهن الأصول التشغيلية."
          : "توجد أصول غير متداولة يمكن فحصها وتقييمها.",
        "القيمة تقديرية حتى تقديم سجل الأصول وتقييم مستقل.",
      ],
    );
  add(
    "kafalah",
    context.riskLevel === "high" ? 42 : 82,
    amount * (context.riskLevel === "low" ? 0.8 : 0.6),
    false,
    [
      context.riskLevel === "high"
        ? "يمكن النظر في التغطية إذا انطبقت أهلية البرنامج رغم ارتفاع المخاطر."
        : "خيار مناسب لتخفيف مخاطر المنشآت الصغيرة والمتوسطة عند الأهلية.",
      "التغطية النهائية لا تعتمد إلا بعد موافقة البرنامج.",
    ],
  );
  add("real_estate", assetHeavy ? 68 : 55, amount * 1.25, false, [
    "ضمان قوي عند توفر أصل عقاري قابل للرهن وتقييم مستقل.",
    "لم تتضمن القوائم وصفاً عقارياً، لذلك يلزم إفصاح وتحقق منفصل.",
  ]);
  add(
    "corporate_guarantee",
    context.applicantType === "startup" ? 67 : 48,
    amount,
    false,
    ["مفيد عند وجود شركة أم أو طرف مؤسسي ذي ملاءة مستقلة."],
  );
  add(
    "personal_guarantee",
    context.riskLevel === "high" ? 62 : 45,
    amount * 0.5,
    false,
    ["ضمان تكميلي لا يحل محل الضمانات العينية أو النقدية."],
  );

  return options.sort(
    (a, b) =>
      Number(b.mandatory) - Number(a.mandatory) ||
      b.suitabilityScore - a.suitabilityScore,
  );
}

export function createCollateralPackage(
  context: CollateralContext,
  now = new Date(),
): CollateralPackage {
  const requiredCoverageRatio = requiredCollateralCoverageRatio(context);
  const recommendations = buildCollateralRecommendations(context);
  const promissory = recommendations.find(
    (recommendation) => recommendation.type === "promissory_note",
  )!;
  const approvedFinancingAmount = Math.round(
    Math.max(context.approvedFinancingAmount, 0),
  );
  const requiredEligibleValue = Math.round(
    approvedFinancingAmount * requiredCoverageRatio,
  );
  const packageDraft: CollateralPackage = {
    version: COLLATERAL_MODEL_VERSION,
    policyVersion: COLLATERAL_POLICY_VERSION,
    status: "recommended",
    approvedFinancingAmount,
    requiredCoverageRatio,
    requiredEligibleValue,
    currentEligibleValue: 0,
    coverageRatio: 0,
    shortfall: requiredEligibleValue,
    recommendations,
    assets: [
      createAssetFromRecommendation(promissory, context.applicantName, now),
    ],
    concentrationWarnings: [],
    missingRequirements: [],
    allMandatoryApproved: false,
    allMandatoryPerfected: false,
    readyForActivation: false,
    disbursementEligible: false,
    enforcementEvents: [],
    lastCalculatedAt: now.toISOString(),
    methodology:
      "القيمة المؤهلة هي القيمة الحالية لصافي الاسترداد بعد الأخذ بالأقل من قيمة البيع الجبري والقيمة السوقية بعد الخصم، وطرح تكاليف التنفيذ والتسييل وخصم مدة الاسترداد. تطبق حدود التركّز مجمعة على كل نوع ضمان، ولا يفتح الصرف قبل التحقق المستندي والنفاذ القانوني والتفعيل.",
    expectedRecoveryAmount: 0,
    recoveryRate: 0,
    lossGivenDefault: 1,
  };
  return recalculateCollateralPackage(packageDraft, now);
}

export function createAssetFromRecommendation(
  recommendation: CollateralRecommendationOption,
  ownerName: string,
  now = new Date(),
): CollateralAsset {
  const marketValue = Math.max(recommendation.estimatedAvailableValue, 0);
  const forcedSaleValue = Math.round(
    marketValue * (1 - recommendation.expectedHaircut),
  );
  return recalculateCollateralAsset(
    {
      id: uuidv4(),
      type: recommendation.type,
      label: recommendation.label,
      description: recommendation.reasons[0] || recommendation.label,
      ownerName,
      ownerType: "company",
      source: "recommendation",
      mandatory: recommendation.mandatory,
      status: "requested",
      lienRank:
        recommendation.type === "promissory_note" ||
        recommendation.type.includes("guarantee") ||
        recommendation.type === "kafalah"
          ? "unsecured"
          : "first",
      haircut: recommendation.expectedHaircut,
      maximumCoverageShare: recommendation.maximumCoverageShare,
      concentrationGroup: recommendation.type,
      valuation: {
        marketValue,
        forcedSaleValue,
        source: "system_estimate",
        currency: "SAR",
        realisationCosts: 0,
        timeToRealiseMonths: 0,
        discountRate: 0,
      },
      eligibleValue: 0,
      cappedEligibleValue: 0,
      documents: [],
      checks: {
        ownershipVerified: false,
        encumbranceChecked: false,
        valuationVerified: false,
        insuranceVerified: false,
        legalPerfectionVerified: false,
      },
      conditions: recommendation.requiredDocuments.map(
        (document) => `تقديم ${document}`,
      ),
      notes: recommendation.caveats.join(" "),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    Number.MAX_SAFE_INTEGER,
    now,
  );
}

export function recalculateCollateralAsset(
  asset: CollateralAsset,
  _requiredEligibleValue: number,
  now = new Date(),
): CollateralAsset {
  const cfg = COLLATERAL_CATALOG[asset.type];
  const haircut = cfg
    ? clamp(Number(asset.haircut), 0, 1)
    : clamp(Number(asset.haircut), 0, 1);
  const marketValue = Math.max(Number(asset.valuation.marketValue ?? 0), 0);
  const haircutValue = marketValue * (1 - haircut);
  const forcedSaleValue =
    asset.valuation.forcedSaleValue == null
      ? haircutValue
      : Math.max(Number(asset.valuation.forcedSaleValue), 0);
  const grossConservativeRecovery = Math.min(forcedSaleValue, haircutValue);
  const realisationCosts = Math.max(
    Number(asset.valuation.realisationCosts ?? 0),
    0,
  );
  const netRealizableValue = Math.max(
    grossConservativeRecovery - realisationCosts,
    0,
  );
  const timeToRealiseMonths = Math.max(
    Number(asset.valuation.timeToRealiseMonths ?? 0),
    0,
  );
  const discountRate = clamp(Number(asset.valuation.discountRate ?? 0), 0, 1);
  const presentValueOfRecovery =
    timeToRealiseMonths > 0
      ? netRealizableValue /
        Math.pow(1 + discountRate, timeToRealiseMonths / 12)
      : netRealizableValue;
  const eligibleValue =
    asset.type === "promissory_note"
      ? 0
      : Math.round(Math.max(presentValueOfRecovery, 0));

  let nextRevaluationDate = asset.valuation.nextRevaluationDate;
  if (!nextRevaluationDate && asset.valuation.valuationDate) {
    const date = new Date(asset.valuation.valuationDate);
    if (!Number.isNaN(date.getTime())) {
      date.setUTCFullYear(date.getUTCFullYear() + 1);
      nextRevaluationDate = date.toISOString().slice(0, 10);
    }
  }

  return {
    ...asset,
    haircut,
    concentrationGroup: asset.concentrationGroup || asset.type,
    valuation: {
      ...asset.valuation,
      marketValue,
      forcedSaleValue: asset.valuation.forcedSaleValue,
      realisationCosts,
      timeToRealiseMonths,
      discountRate,
      netRealizableValue: Math.round(netRealizableValue),
      presentValueOfRecovery: Math.round(presentValueOfRecovery),
      nextRevaluationDate,
    },
    eligibleValue,
    // The package-level calculation applies the aggregate concentration cap.
    cappedEligibleValue: eligibleValue,
    updatedAt: now.toISOString(),
  };
}

export function recalculateCollateralPackage(
  input: CollateralPackage,
  now = new Date(),
): CollateralPackage {
  const requiredEligibleValue = Math.round(
    Math.max(input.approvedFinancingAmount, 0) *
      clamp(input.requiredCoverageRatio, 0, 2),
  );
  const individuallyCalculated = input.assets.map((asset) =>
    recalculateCollateralAsset(asset, requiredEligibleValue, now),
  );

  // Concentration caps are applied to the aggregate exposure by collateral type/group,
  // not independently to each asset.
  const grouped = new Map<string, CollateralAsset[]>();
  for (const asset of individuallyCalculated) {
    const group = asset.concentrationGroup || asset.type;
    grouped.set(group, [...(grouped.get(group) || []), asset]);
  }

  const concentrationWarnings: string[] = [];
  const cappedById = new Map<string, number>();
  for (const [group, groupAssets] of grouped) {
    const groupEligible = groupAssets.reduce(
      (sum, asset) => sum + asset.eligibleValue,
      0,
    );
    const maximumShare = Math.min(
      ...groupAssets.map((asset) => clamp(asset.maximumCoverageShare, 0, 1)),
    );
    // When policy does not require tangible collateral (for a strong low-risk case),
    // keep any voluntarily submitted asset's estimated value visible instead of
    // reducing it to zero. Concentration then uses approved exposure as the base.
    const concentrationBase =
      requiredEligibleValue > 0
        ? requiredEligibleValue
        : Math.max(input.approvedFinancingAmount, 0);
    const groupCap = concentrationBase * maximumShare;
    const scale = groupEligible > 0 ? Math.min(1, groupCap / groupEligible) : 1;
    for (const asset of groupAssets)
      cappedById.set(asset.id, Math.round(asset.eligibleValue * scale));
    if (groupEligible > groupCap + 1) {
      const label = COLLATERAL_CATALOG[groupAssets[0].type]?.label || group;
      concentrationWarnings.push(
        `${label}: جرى تقييد إجمالي هذا النوع إلى ${(maximumShare * 100).toFixed(0)}% من التغطية المطلوبة؛ الحد يطبق مجمعًا على جميع أصول النوع.`,
      );
    }
  }

  const assets = individuallyCalculated.map((asset) => ({
    ...asset,
    cappedEligibleValue: cappedById.get(asset.id) ?? asset.eligibleValue,
  }));
  const acceptedStatuses = new Set([
    "approved",
    "perfection_pending",
    "perfected",
    "active",
  ]);
  const acceptedAssets = assets.filter((asset) =>
    acceptedStatuses.has(asset.status),
  );
  const currentEligibleValue = Math.round(
    acceptedAssets.reduce((sum, asset) => sum + asset.cappedEligibleValue, 0),
  );
  const coverageRatio =
    input.approvedFinancingAmount > 0
      ? currentEligibleValue / input.approvedFinancingAmount
      : 0;
  const shortfall = Math.max(requiredEligibleValue - currentEligibleValue, 0);
  const mandatory = assets.filter((asset) => asset.mandatory);
  const allMandatoryApproved =
    mandatory.length > 0 &&
    mandatory.every((asset) => acceptedStatuses.has(asset.status));
  const allMandatoryPerfected =
    mandatory.length > 0 &&
    mandatory.every(
      (asset) =>
        ["perfected", "active"].includes(asset.status) &&
        asset.checks.legalPerfectionVerified,
    );

  const missingRequirements: string[] = [];
  if (requiredEligibleValue > 0 && shortfall > 0)
    missingRequirements.push(
      `عجز في التغطية المؤهلة بقيمة ${shortfall.toLocaleString("ar-SA")} ريال.`,
    );
  if (!allMandatoryApproved)
    missingRequirements.push("لم تعتمد جميع الضمانات الإلزامية.");
  if (!allMandatoryPerfected)
    missingRequirements.push(
      "لم يكتمل التوثيق والنفاذ القانوني لجميع الضمانات الإلزامية.",
    );
  for (const asset of acceptedAssets) {
    const cfg = COLLATERAL_CATALOG[asset.type];
    const missingChecks = cfg.defaultChecks.filter(
      (check) => !asset.checks[check],
    );
    if (missingChecks.length)
      missingRequirements.push(`${asset.label}: توجد فحوصات تحقق غير مكتملة.`);
    const requiredDocumentTypes = collateralDocumentRequirements(
      asset.type,
      "all",
    );
    const verifiedDocumentTypes = new Set(
      asset.documents
        .filter((document) => document.status === "verified")
        .map((document) => document.type),
    );
    const missingDocumentTypes = requiredDocumentTypes.filter(
      (type) => !verifiedDocumentTypes.has(type),
    );
    if (missingDocumentTypes.length)
      missingRequirements.push(
        `${asset.label}: مستندات إلزامية غير متحققة (${missingDocumentTypes.join("، ")}).`,
      );
    if (asset.documents.some((document) => document.status === "pending"))
      missingRequirements.push(`${asset.label}: توجد مستندات بانتظار التحقق.`);
    if (
      asset.valuation.expiryDate &&
      new Date(asset.valuation.expiryDate).getTime() < now.getTime()
    )
      missingRequirements.push(`${asset.label}: التقييم منتهي الصلاحية.`);
    if (
      asset.valuation.nextRevaluationDate &&
      new Date(asset.valuation.nextRevaluationDate).getTime() < now.getTime()
    )
      missingRequirements.push(
        `${asset.label}: حان موعد إعادة التقييم الدوري.`,
      );
    if (asset.lienRank === "second")
      missingRequirements.push(
        `${asset.label}: رهن من المرتبة الثانية ويتطلب موافقة صريحة على أولوية الاسترداد.`,
      );
  }

  const packageApproved = Boolean(input.approvedAt && input.approvedBy);
  const requiresEligibleCollateral = requiredEligibleValue > 0;
  const hasEligibleCollateral =
    !requiresEligibleCollateral ||
    assets.some(
      (asset) =>
        asset.cappedEligibleValue > 0 &&
        ["perfected", "active"].includes(asset.status),
    );
  const readyForActivation =
    packageApproved &&
    shortfall <= 0 &&
    allMandatoryPerfected &&
    hasEligibleCollateral &&
    missingRequirements.length === 0;
  const disbursementEligible =
    readyForActivation && Boolean(input.activatedAt && input.activatedBy);
  const status = derivePackageStatus(input.status, {
    packageApproved,
    disbursementEligible,
    shortfall,
    allMandatoryApproved,
    allMandatoryPerfected,
  });
  const expectedRecoveryAmount = Math.min(
    currentEligibleValue,
    Math.max(input.approvedFinancingAmount, 0),
  );
  const recoveryRate =
    input.approvedFinancingAmount > 0
      ? clamp(expectedRecoveryAmount / input.approvedFinancingAmount, 0, 1)
      : 0;
  const lossGivenDefault = 1 - recoveryRate;

  return {
    ...input,
    version: COLLATERAL_MODEL_VERSION,
    policyVersion: input.policyVersion || COLLATERAL_POLICY_VERSION,
    status,
    requiredEligibleValue,
    assets,
    currentEligibleValue,
    coverageRatio: round(coverageRatio, 4),
    shortfall,
    concentrationWarnings: unique(concentrationWarnings),
    missingRequirements: unique(missingRequirements),
    allMandatoryApproved,
    allMandatoryPerfected,
    readyForActivation,
    disbursementEligible,
    expectedRecoveryAmount: Math.round(expectedRecoveryAmount),
    recoveryRate: round(recoveryRate, 4),
    lossGivenDefault: round(lossGivenDefault, 4),
    lastCalculatedAt: now.toISOString(),
  };
}

function derivePackageStatus(
  current: CollateralPackageStatus,
  state: {
    packageApproved: boolean;
    disbursementEligible: boolean;
    shortfall: number;
    allMandatoryApproved: boolean;
    allMandatoryPerfected: boolean;
  },
): CollateralPackageStatus {
  if (["enforcement", "released"].includes(current)) return current;
  if (state.disbursementEligible) return "active";
  if (state.packageApproved && state.shortfall > 0) return "shortfall";
  if (state.packageApproved && !state.allMandatoryPerfected)
    return "perfection_pending";
  if (state.packageApproved) return "approved";
  if (current === "under_review" || current === "awaiting_submission")
    return current;
  if (state.allMandatoryApproved) return "under_review";
  return current === "draft" ? "draft" : "recommended";
}

export function addCollateralDocument(
  asset: CollateralAsset,
  document: Omit<CollateralDocument, "id" | "uploadedAt" | "status">,
  now = new Date(),
): CollateralAsset {
  return {
    ...asset,
    documents: [
      ...asset.documents,
      {
        ...document,
        id: uuidv4(),
        uploadedAt: now.toISOString(),
        status: "pending",
      },
    ],
    updatedAt: now.toISOString(),
  };
}

export function collateralContextFromRequest(
  request: FinancingRequestRecord,
  report: CompanyReportData | StartupReportData | null,
): CollateralContext {
  const company =
    report && "financials" in report ? (report as CompanyReportData) : null;
  const startup =
    report && "fundingNeeded" in report ? (report as StartupReportData) : null;
  const amount =
    request.creditReview?.approvedAmount ||
    request.creditReview?.recommendedAmount ||
    company?.funding.amount ||
    startup?.recommendedCapital ||
    request.input.requestedAmount;
  const riskLevel =
    request.lifecycle?.monitoringPlan.currentRiskLevel ||
    company?.risk.riskLevel ||
    (startup
      ? startup.successProbability >= 65
        ? "low"
        : startup.successProbability >= 45
          ? "medium"
          : "high"
      : "medium");
  const defaultProbability =
    request.lifecycle?.protectionPlan.defaultProbability ??
    company?.risk.defaultProbability ??
    (startup ? 100 - startup.successProbability : 20);
  return {
    approvedFinancingAmount: amount,
    applicantName: request.applicantName,
    applicantType: request.applicantType,
    sector: request.sector,
    riskLevel,
    defaultProbability,
    dscr: company?.funding.dscrAfterFinancing ?? company?.ratios.dscr ?? null,
    debtRatio: company?.ratios.debtRatio ?? null,
    company,
    startup,
  };
}

export function syncLifecycleWithCollateral(
  lifecycle: FinancingLifecyclePlan | undefined,
  collateral: CollateralPackage,
): FinancingLifecyclePlan | undefined {
  if (!lifecycle) return lifecycle;
  const status = collateral.disbursementEligible
    ? "accepted"
    : collateral.status === "shortfall"
      ? "rejected"
      : collateral.status === "awaiting_submission"
        ? "pending_submission"
        : "required";
  return {
    ...lifecycle,
    guaranteePlan: {
      ...lifecycle.guaranteePlan,
      requiredAmount: collateral.requiredEligibleValue,
      coverageRatio: collateral.requiredCoverageRatio,
      recommendedType: collateral.recommendations
        .slice(0, 3)
        .map((r) => r.label)
        .join(" + "),
      status,
      notes: [
        ...lifecycle.guaranteePlan.notes,
        `التغطية المؤهلة الحالية: ${collateral.currentEligibleValue.toLocaleString("ar-SA")} ريال.`,
        collateral.disbursementEligible
          ? "اكتملت ضوابط الضمان وأصبح الملف مؤهلاً للصرف."
          : "الصرف محجوب حتى اكتمال التغطية والتوثيق والنفاذ القانوني.",
      ],
    },
    protectionPlan: {
      ...lifecycle.protectionPlan,
      guaranteeValue: collateral.currentEligibleValue,
      guaranteeCoverageRatio:
        collateral.approvedFinancingAmount > 0
          ? collateral.currentEligibleValue / collateral.approvedFinancingAmount
          : 0,
    },
  };
}

export function isCollateralReadyForDisbursement(
  request: FinancingRequestRecord,
) {
  return Boolean(request.collateral?.disbursementEligible);
}

function positive(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}
