import {
  ExtractedFinancials,
  Ratios,
  RiskScore,
  Vision2030Score,
  FundingRecommendation,
  IndustryBenchmark,
  SectorComparisonMetric,
  CompanyReportData,
  CompanyImpactProfile,
  RiskScoreComponent,
} from "./types";
import { buildCompanyFinancingLifecycle } from "./financingLifecycle";
import financialModel from "../config/financial-model.json";
import { requiredCollateralCoverageRatio } from "./collateralPolicy";

/* ------------------------------------------------------------------ */
/* 1. Financial field definitions                                            */
/* ------------------------------------------------------------------ */

export const CORE_FINANCIAL_FIELDS = [
  "totalAssets",
  "currentAssets",
  "cash",
  "inventory",
  "accountsReceivable",
  "totalLiabilities",
  "currentLiabilities",
  "shortTermDebt",
  "longTermDebt",
  "equity",
  "revenue",
  "costOfGoodsSold",
  "grossProfit",
  "operatingExpenses",
  "operatingIncome",
  "netIncome",
  "interestExpense",
  "zakatTax",
  "operatingCashFlow",
  "investingCashFlow",
  "financingCashFlow",
  "netCashFlow",
  "endingCashBalance",
] as const satisfies readonly (keyof ExtractedFinancials)[];

export const BANKING_SUPPLEMENTAL_FIELDS = [
  "retainedEarnings",
  "depreciation",
  "amortization",
  "cfads",
  "maintenanceCapex",
  "scheduledPrincipal",
  "scheduledInterest",
  "mandatoryDebtFees",
  "financeLeasePayments",
] as const satisfies readonly (keyof ExtractedFinancials)[];

export const FINANCIAL_FIELDS = [
  ...CORE_FINANCIAL_FIELDS,
  ...BANKING_SUPPLEMENTAL_FIELDS,
] as const;

export type FinancialField = (typeof FINANCIAL_FIELDS)[number];

export const FIELD_LABELS_AR: Record<FinancialField, string> = {
  totalAssets: "إجمالي الأصول",
  currentAssets: "الأصول المتداولة",
  cash: "النقد وما يعادله",
  inventory: "المخزون",
  accountsReceivable: "الحسابات المدينة",
  totalLiabilities: "إجمالي الالتزامات",
  currentLiabilities: "الالتزامات المتداولة",
  shortTermDebt: "الديون قصيرة الأجل",
  longTermDebt: "الديون طويلة الأجل",
  equity: "حقوق الملكية",
  retainedEarnings: "الأرباح المبقاة",
  revenue: "الإيرادات",
  costOfGoodsSold: "تكلفة المبيعات",
  grossProfit: "مجمل الربح",
  operatingExpenses: "المصاريف التشغيلية",
  operatingIncome: "الربح التشغيلي / EBIT",
  netIncome: "صافي الربح",
  interestExpense: "مصروف الفوائد",
  zakatTax: "الزكاة والضريبة",
  depreciation: "الإهلاك",
  amortization: "الاستهلاك",
  operatingCashFlow: "التدفق النقدي التشغيلي",
  investingCashFlow: "التدفق النقدي الاستثماري",
  financingCashFlow: "التدفق النقدي التمويلي",
  netCashFlow: "صافي التدفق النقدي",
  endingCashBalance: "الرصيد النقدي النهائي",
  cfads: "النقد المتاح لخدمة الدين CFADS",
  maintenanceCapex: "الإنفاق الرأسمالي الضروري",
  scheduledPrincipal: "أصل الدين المجدول خلال الفترة",
  scheduledInterest: "فوائد/أرباح التمويل المجدولة",
  mandatoryDebtFees: "رسوم خدمة الدين الإلزامية",
  financeLeasePayments: "دفعات الإيجار التمويلي",
};

export const FINANCIAL_FIELD_TO_SNAKE: Record<FinancialField, string> = {
  totalAssets: "total_assets",
  currentAssets: "current_assets",
  cash: "cash",
  inventory: "inventory",
  accountsReceivable: "accounts_receivable",
  totalLiabilities: "total_liabilities",
  currentLiabilities: "current_liabilities",
  shortTermDebt: "short_term_debt",
  longTermDebt: "long_term_debt",
  equity: "equity",
  retainedEarnings: "retained_earnings",
  revenue: "revenue",
  costOfGoodsSold: "cost_of_goods_sold",
  grossProfit: "gross_profit",
  operatingExpenses: "operating_expenses",
  operatingIncome: "operating_income",
  netIncome: "net_income",
  interestExpense: "interest_expense",
  zakatTax: "zakat_tax",
  depreciation: "depreciation",
  amortization: "amortization",
  operatingCashFlow: "operating_cash_flow",
  investingCashFlow: "investing_cash_flow",
  financingCashFlow: "financing_cash_flow",
  netCashFlow: "net_cash_flow",
  endingCashBalance: "ending_cash_balance",
  cfads: "cfads",
  maintenanceCapex: "maintenance_capex",
  scheduledPrincipal: "scheduled_principal",
  scheduledInterest: "scheduled_interest",
  mandatoryDebtFees: "mandatory_debt_fees",
  financeLeasePayments: "finance_lease_payments",
};

const SNAKE_TO_FINANCIAL_FIELD = Object.fromEntries(
  Object.entries(FINANCIAL_FIELD_TO_SNAKE).map(([key, value]) => [value, key]),
) as Record<string, FinancialField>;

export const MANUAL_FIELD_GROUPS: {
  title: string;
  description: string;
  fields: FinancialField[];
}[] = [
  {
    title: "قائمة المركز المالي",
    description: "الأصول، الالتزامات، وحقوق الملكية.",
    fields: [
      "totalAssets",
      "currentAssets",
      "cash",
      "inventory",
      "accountsReceivable",
      "totalLiabilities",
      "currentLiabilities",
      "shortTermDebt",
      "longTermDebt",
      "equity",
    ],
  },
  {
    title: "قائمة الدخل",
    description: "الإيرادات، التكاليف، والربحية التشغيلية والنهائية.",
    fields: [
      "revenue",
      "costOfGoodsSold",
      "grossProfit",
      "operatingExpenses",
      "operatingIncome",
      "netIncome",
      "interestExpense",
      "zakatTax",
    ],
  },
  {
    title: "قائمة التدفقات النقدية",
    description: "النقد التشغيلي والاستثماري والتمويلي وصافي التغير.",
    fields: [
      "operatingCashFlow",
      "investingCashFlow",
      "financingCashFlow",
      "netCashFlow",
      "endingCashBalance",
    ],
  },
  {
    title: "الملحق المصرفي لخدمة الدين",
    description:
      "حقول إضافية لازمة لحساب DSCR المصرفي وAltman الكامل وإصدار توصية تمويل آلية. الحقول اختيارية للتحليل العام لكنها إلزامية للقرار الائتماني الآلي.",
    fields: [...BANKING_SUPPLEMENTAL_FIELDS],
  },
];

export function mapSnakeFinancials(
  row: Record<string, unknown>,
): ExtractedFinancials {
  const financials = {} as ExtractedFinancials;
  FINANCIAL_FIELDS.forEach((field) => {
    const snake = FINANCIAL_FIELD_TO_SNAKE[field];
    financials[field] = toNullableNumber(row[snake]);
  });
  return financials;
}

export function mapFinancialsToSnake(
  financials: Partial<Record<FinancialField, unknown>>,
) {
  const row: Record<string, unknown> = {};
  FINANCIAL_FIELDS.forEach((field) => {
    row[FINANCIAL_FIELD_TO_SNAKE[field]] = financials[field] ?? "";
  });
  return row;
}

export function translateMissingFields(fields: string[] = []): string[] {
  return fields.map((field) => {
    const canonical =
      SNAKE_TO_FINANCIAL_FIELD[field] || (field as FinancialField);
    return FIELD_LABELS_AR[canonical] || field;
  });
}

/* ------------------------------------------------------------------ */
/* 2. Financial metric calculation                      */
/* ------------------------------------------------------------------ */

function safeDivide(
  a: number | null | undefined,
  b: number | null | undefined,
) {
  if (
    a === null ||
    a === undefined ||
    b === null ||
    b === undefined ||
    b === 0
  ) {
    return null;
  }
  return a / b;
}

function round(n: number | null, digits = 4): number | null {
  if (n === null || !Number.isFinite(n)) return null;
  const factor = 10 ** digits;
  return Number((Math.round(n * factor) / factor).toFixed(digits));
}

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function calculateMetricsFromFinancials(
  financials: ExtractedFinancials,
): Record<string, number | string | null> {
  const f = financials;
  const metrics: Record<string, number | string | null> = {};

  metrics.current_ratio = round(
    safeDivide(f.currentAssets, f.currentLiabilities),
  );
  metrics.quick_ratio = round(
    safeDivide(num(f.currentAssets) - num(f.inventory), f.currentLiabilities),
  );
  metrics.cash_ratio = round(safeDivide(f.cash, f.currentLiabilities));
  metrics.working_capital = round(
    num(f.currentAssets) - num(f.currentLiabilities),
    2,
  );

  metrics.debt_to_equity = round(safeDivide(f.totalLiabilities, f.equity));
  metrics.debt_ratio = round(safeDivide(f.totalLiabilities, f.totalAssets));
  metrics.equity_ratio = round(safeDivide(f.equity, f.totalAssets));

  metrics.gross_profit_margin = round(safeDivide(f.grossProfit, f.revenue));
  metrics.operating_margin = round(safeDivide(f.operatingIncome, f.revenue));
  metrics.net_profit_margin = round(safeDivide(f.netIncome, f.revenue));
  metrics.roa = round(safeDivide(f.netIncome, f.totalAssets));
  metrics.roe = round(safeDivide(f.netIncome, f.equity));
  // EBIT = الربح التشغيلي. EBITDA لا يظهر إلا عند توفر الإهلاك/الاستهلاك فعلياً.
  metrics.ebit = round(f.operatingIncome, 2);
  metrics.ebit_margin = round(safeDivide(f.operatingIncome, f.revenue));
  if (
    f.operatingIncome !== null &&
    (f.depreciation !== null || f.amortization !== null)
  ) {
    const ebitda =
      f.operatingIncome + num(f.depreciation) + num(f.amortization);
    metrics.ebitda = round(ebitda, 2);
    metrics.ebitda_margin = round(safeDivide(ebitda, f.revenue));
  } else {
    metrics.ebitda = null;
    metrics.ebitda_margin = null;
  }

  metrics.interest_coverage = round(
    safeDivide(f.operatingIncome, f.interestExpense),
  );

  // DSCR مصرفي: CFADS / أصل الدين والفوائد والرسوم والإيجارات التمويلية
  // المستحقة تعاقدياً خلال الفترة. لا نستخدم رصيد الدين قصير الأجل كبديل للقسط.
  const explicitCfads = f.cfads;
  const derivedCfads =
    f.operatingCashFlow !== null && f.maintenanceCapex !== null
      ? f.operatingCashFlow - f.maintenanceCapex
      : null;
  const cfads = explicitCfads !== null ? explicitCfads : derivedCfads;
  const debtServiceFields = [
    f.scheduledPrincipal,
    f.scheduledInterest,
    f.mandatoryDebtFees,
    f.financeLeasePayments,
  ];
  const debtServiceDataComplete = debtServiceFields.every(
    (value) => value !== null,
  );
  const contractualDebtService = debtServiceDataComplete
    ? debtServiceFields.reduce((sum, value) => sum + num(value), 0)
    : null;
  metrics.cfads = round(cfads, 2);
  metrics.contractual_debt_service = round(contractualDebtService, 2);
  metrics.dscr = round(safeDivide(cfads, contractualDebtService));
  metrics.dscr_method =
    cfads === null ||
    contractualDebtService === null ||
    contractualDebtService <= 0
      ? "unavailable"
      : explicitCfads !== null
        ? "cfads_contractual"
        : "ocf_less_maintenance_capex";
  const bankingChecks = [
    f.retainedEarnings !== null,
    cfads !== null,
    ...debtServiceFields.map((value) => value !== null),
  ];
  metrics.banking_data_quality = round(
    (bankingChecks.filter(Boolean).length / bankingChecks.length) * 100,
    0,
  );

  metrics.operating_cash_flow_ratio = round(
    safeDivide(f.operatingCashFlow, f.currentLiabilities),
  );
  metrics.operating_cash_flow_to_debt = round(
    safeDivide(f.operatingCashFlow, f.totalLiabilities),
  );
  // FCF = التدفق التشغيلي + التدفق الاستثماري (الاستثماري سالب عند الإنفاق
  // الرأسمالي وموجب عند بيع الأصول، فالجمع الجبري هو الصيغة الصحيحة).
  metrics.free_cash_flow = round(
    f.operatingCashFlow === null || f.investingCashFlow === null
      ? null
      : f.operatingCashFlow + f.investingCashFlow,
    2,
  );

  metrics.asset_turnover = round(safeDivide(f.revenue, f.totalAssets));
  metrics.inventory_turnover = round(
    safeDivide(f.costOfGoodsSold, f.inventory),
  );
  metrics.receivables_turnover = round(
    safeDivide(f.revenue, f.accountsReceivable),
  );

  const wc = num(f.currentAssets) - num(f.currentLiabilities);
  if (
    f.totalAssets !== null &&
    f.totalAssets !== 0 &&
    f.operatingIncome !== null &&
    f.equity !== null &&
    f.totalLiabilities !== null &&
    f.totalLiabilities !== 0 &&
    f.revenue !== null &&
    f.retainedEarnings !== null
  ) {
    // Altman Z' الكامل للشركات الخاصة. لا نطبق حدود النموذج القياسية على
    // معادلة ناقصة؛ عند غياب الأرباح المبقاة تكون النتيجة غير متاحة.
    const altmanZ =
      0.717 * (wc / f.totalAssets) +
      0.847 * (f.retainedEarnings / f.totalAssets) +
      3.107 * (f.operatingIncome / f.totalAssets) +
      0.42 * (f.equity / f.totalLiabilities) +
      0.998 * (f.revenue / f.totalAssets);
    metrics.altman_z_score = round(altmanZ);
    metrics.altman_model = "private_full";
  } else {
    metrics.altman_z_score = null;
    metrics.altman_model = "unavailable";
  }

  return metrics;
}

export function mapEtlMetricsToRatios(
  metrics: Record<string, unknown>,
): Ratios {
  const get = (key: string) => toNullableNumber(metrics[key]);
  return {
    liquidityRatio: get("current_ratio"),
    debtRatio: get("debt_ratio"),
    profitMargin: get("net_profit_margin"),
    cashFlow: get("operating_cash_flow_ratio"),
    zScore: get("altman_z_score"),
    currentRatio: get("current_ratio"),
    quickRatio: get("quick_ratio"),
    cashRatio: get("cash_ratio"),
    workingCapital: get("working_capital"),
    debtToEquity: get("debt_to_equity"),
    equityRatio: get("equity_ratio"),
    grossProfitMargin: get("gross_profit_margin"),
    operatingMargin: get("operating_margin"),
    netProfitMargin: get("net_profit_margin"),
    roa: get("roa"),
    roe: get("roe"),
    ebit: get("ebit"),
    ebitMargin: get("ebit_margin"),
    ebitda: get("ebitda"),
    ebitdaMargin: get("ebitda_margin"),
    interestCoverage: get("interest_coverage"),
    dscr: get("dscr"),
    cfads: get("cfads"),
    contractualDebtService: get("contractual_debt_service"),
    dscrMethod:
      metrics.dscr_method === "cfads_contractual" ||
      metrics.dscr_method === "ocf_less_maintenance_capex"
        ? metrics.dscr_method
        : "unavailable",
    bankingDataQuality: get("banking_data_quality") ?? 0,
    operatingCashFlowRatio: get("operating_cash_flow_ratio"),
    operatingCashFlowToDebt: get("operating_cash_flow_to_debt"),
    freeCashFlow: get("free_cash_flow"),
    assetTurnover: get("asset_turnover"),
    inventoryTurnover: get("inventory_turnover"),
    receivablesTurnover: get("receivables_turnover"),
    altmanModel:
      typeof metrics.altman_model === "string" ? metrics.altman_model : null,
  };
}

// Backward-compatible name used by older code/tests. It now mirrors processed-data formulas.
export function computeRatios(financials: ExtractedFinancials): Ratios {
  return mapEtlMetricsToRatios(calculateMetricsFromFinancials(financials));
}

export const FORMULAS_VERSION = "financial-pulse-formulas-v4.0-bank-grade";

const VERIFIED_METRIC_KEYS = [
  "current_ratio",
  "quick_ratio",
  "cash_ratio",
  "working_capital",
  "debt_to_equity",
  "debt_ratio",
  "equity_ratio",
  "gross_profit_margin",
  "operating_margin",
  "net_profit_margin",
  "roa",
  "roe",
  "ebit",
  "ebit_margin",
  "interest_coverage",
  "cfads",
  "contractual_debt_service",
  "dscr",
  "banking_data_quality",
  "operating_cash_flow_ratio",
  "operating_cash_flow_to_debt",
  "free_cash_flow",
  "asset_turnover",
  "inventory_turnover",
  "receivables_turnover",
  "altman_z_score",
] as const;

function valuesClose(
  a: number | null,
  b: number | null,
  tolerance = 0.00011,
): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return Math.abs(a - b) <= tolerance;
}

export function verifyMetricConsistency(
  financials: ExtractedFinancials,
  pipelineMetrics: Record<string, unknown> = {},
) {
  const recalculatedMetrics = calculateMetricsFromFinancials(financials);
  const issues: string[] = [];
  const correctedMetricKeys: string[] = [];

  VERIFIED_METRIC_KEYS.forEach((key) => {
    const fromPipeline = toNullableNumber(pipelineMetrics[key]);
    const fromFormula = toNullableNumber(recalculatedMetrics[key]);
    if (!valuesClose(fromPipeline, fromFormula)) {
      correctedMetricKeys.push(key);
      issues.push(
        `${key}: pipeline=${fromPipeline ?? "null"}, formula=${fromFormula ?? "null"}`,
      );
    }
  });

  return {
    metricsVerified: issues.length === 0,
    issues,
    correctedMetricKeys,
    recalculatedMetrics,
    formulasVersion: FORMULAS_VERSION,
  };
}

export function buildVerifiedRatios(
  financials: ExtractedFinancials,
  pipelineMetrics: Record<string, unknown> = {},
) {
  const verification = verifyMetricConsistency(financials, pipelineMetrics);
  const metricsToUse = verification.metricsVerified
    ? pipelineMetrics
    : { ...verification.recalculatedMetrics };

  // عند السقوط على القيم المعاد حسابها، نحافظ على نموذج Altman الكامل
  // وقيم EBITDA الحقيقية القادمة من الـ pipeline لأن الواجهة لا تستطيع
  // إعادة إنتاجها من حقول الإدخال القياسية.
  if (!verification.metricsVerified) {
    if (pipelineMetrics["altman_model"] === "private_full") {
      metricsToUse["altman_z_score"] = pipelineMetrics["altman_z_score"];
      metricsToUse["altman_model"] = pipelineMetrics["altman_model"];
    }
    if (pipelineMetrics["ebitda"] !== undefined) {
      metricsToUse["ebitda"] = pipelineMetrics["ebitda"];
      metricsToUse["ebitda_margin"] = pipelineMetrics["ebitda_margin"];
    }
  }

  return {
    ratios: mapEtlMetricsToRatios(metricsToUse),
    metrics: metricsToUse,
    audit: {
      metricsVerified: verification.metricsVerified,
      formulasVersion: verification.formulasVersion,
      checkedAt: new Date().toISOString(),
      issues: verification.issues,
      correctedMetricKeys: verification.correctedMetricKeys,
    },
  };
}

export function normalizeCompanyReportData(
  data: CompanyReportData,
): CompanyReportData {
  const metrics = calculateMetricsFromFinancials(data.financials);
  const ratios = mapEtlMetricsToRatios(metrics);
  const risk = computeRiskScore(data.financials, ratios);
  const vision2030 = computeVision2030Score(
    data.sector,
    data.impactProfile?.employeeCount ?? undefined,
    ratios,
    data.impactProfile,
  );
  const funding = computeFundingRecommendation(data.financials, ratios, risk);
  const financingLifecycle = buildCompanyFinancingLifecycle({
    financials: data.financials,
    ratios,
    risk,
    funding,
  });
  const benchmark = getIndustryBenchmark(data.sector);
  const sectorComparison = compareWithIndustry(ratios, benchmark);

  return {
    ...data,
    ratios,
    risk,
    vision2030,
    funding,
    financingLifecycle,
    benchmark,
    sectorComparison,
    analysisAudit: {
      metricsVerified: true,
      formulasVersion: FORMULAS_VERSION,
      checkedAt: new Date().toISOString(),
      issues: [],
      correctedMetricKeys: [],
    },
  };
}

/* ------------------------------------------------------------------ */
/* 3. Transparent credit-risk scorecard                               */
/* ------------------------------------------------------------------ */

const CREDIT_MODEL_VERSION = "credit-scorecard-v3.0";

export function computeRiskScore(
  financials: ExtractedFinancials,
  ratios: Ratios,
  _scoring?: Record<string, unknown>,
): RiskScore {
  const components = calculateHealthComponents(financials, ratios);
  const healthScore = clamp(
    Math.round(components.reduce((sum, item) => sum + item.contribution, 0)),
    0,
    100,
  );

  // نموذج شفاف مؤقت لدعم القرار فقط. لا يُسمح باستخدامه كـ PD رقابي
  // قبل المعايرة على بيانات تعثر تاريخية، التحقق المستقل، والـ backtesting.
  let logit = -4.5 + 0.08 * (100 - healthScore);
  if (ratios.zScore !== null && ratios.altmanModel === "private_full") {
    if (ratios.zScore < 1.23) logit += 1;
    else if (ratios.zScore < 2.9) logit += 0.25;
    else logit -= 0.2;
  }
  if (ratios.dscr !== null) {
    if (ratios.dscr < 1) logit += 0.8;
    else if (ratios.dscr < 1.25) logit += 0.35;
  }
  if (financials.netIncome !== null && financials.netIncome < 0) logit += 0.5;

  const defaultProbability = roundTo(
    clamp(100 / (1 + Math.exp(-logit)), 0.5, 95),
    1,
  );
  const riskLevel: RiskScore["riskLevel"] =
    defaultProbability <= 10
      ? "low"
      : defaultProbability <= 30
        ? "medium"
        : "high";

  const missingModelInputs: string[] = [];
  if (ratios.dscr === null) {
    missingModelInputs.push(
      "CFADS وأصل الدين والفوائد والرسوم والإيجارات التمويلية المستحقة خلال الفترة",
    );
  }
  if (ratios.zScore === null)
    missingModelInputs.push("الأرباح المبقاة لحساب Altman Z' الكامل");

  return {
    defaultProbability,
    riskLevel,
    healthScore,
    components,
    methodology:
      "درجة موزونة من المؤشرات المتاحة فقط؛ يعاد تطبيع الأوزان تلقائياً عند غياب DSCR المصرفي أو Altman الكامل، ولا تمنح الحقول الناقصة درجة محايدة مصطنعة.",
    probabilityMethodology:
      "احتمال تعثر تقديري لمدة 12 شهراً عبر تحويل لوجستي شفاف. النموذج مؤقت وغير معاير على بيانات تعثر بنك، لذلك لا يستخدم للمخصصات أو رأس المال أو قرار آلي نهائي.",
    modelVersion: CREDIT_MODEL_VERSION,
    modelStatus: "provisional",
    regulatoryUseAllowed: false,
    missingModelInputs,
  };
}

function calculateHealthComponents(
  financials: ExtractedFinancials,
  ratios: Ratios,
): RiskScoreComponent[] {
  const liquidityValues: Array<[number | null, number]> = [
    [ratios.currentRatio, 0.5],
    [ratios.quickRatio, 0.3],
    [ratios.cashRatio, 0.2],
  ];
  const leverageValues: Array<[number | null, number, boolean?]> = [
    [ratios.debtRatio, 0.7, true],
    [ratios.debtToEquity, 0.3, true],
  ];
  const profitabilityValues: Array<[number | null, number]> = [
    [ratios.netProfitMargin, 0.4],
    [ratios.operatingMargin, 0.3],
    [ratios.roa, 0.3],
  ];

  const liquidity = weightedAvailable([
    [ratios.currentRatio, scoreLinear(ratios.currentRatio, 0.7, 2), 0.5],
    [ratios.quickRatio, scoreLinear(ratios.quickRatio, 0.5, 1.5), 0.3],
    [ratios.cashRatio, scoreLinear(ratios.cashRatio, 0.05, 0.5), 0.2],
  ]);
  const leverage = weightedAvailable([
    [ratios.debtRatio, scoreLinear(ratios.debtRatio, 0.8, 0.3, true), 0.7],
    [ratios.debtToEquity, scoreLinear(ratios.debtToEquity, 3, 0.7, true), 0.3],
  ]);
  const profitability = weightedAvailable([
    [ratios.netProfitMargin, scoreLinear(ratios.netProfitMargin, 0, 0.15), 0.4],
    [ratios.operatingMargin, scoreLinear(ratios.operatingMargin, 0, 0.18), 0.3],
    [ratios.roa, scoreLinear(ratios.roa, 0, 0.12), 0.3],
  ]);
  const debtService = weightedAvailable([
    [ratios.dscr, scoreLinear(ratios.dscr, 0.8, 1.75), 0.65],
    [ratios.interestCoverage, scoreLinear(ratios.interestCoverage, 1, 5), 0.35],
  ]);
  const freeCashFlowMargin = safeDivide(
    ratios.freeCashFlow,
    financials.revenue,
  );
  const cashFlow = weightedAvailable([
    [
      ratios.operatingCashFlowRatio,
      scoreLinear(ratios.operatingCashFlowRatio, 0.1, 1),
      0.45,
    ],
    [
      ratios.operatingCashFlowToDebt,
      scoreLinear(ratios.operatingCashFlowToDebt, 0.05, 0.35),
      0.35,
    ],
    [freeCashFlowMargin, scoreLinear(freeCashFlowMargin, -0.05, 0.1), 0.2],
  ]);
  const distressAvailable =
    ratios.zScore !== null && ratios.altmanModel === "private_full";
  const distress = distressAvailable
    ? scoreLinear(ratios.zScore, 1.23, 2.9)
    : 0;

  const definitions: Array<{
    key: RiskScoreComponent["key"];
    label: string;
    score: number;
    baseWeight: number;
    available: boolean;
    note: string;
  }> = [
    {
      key: "liquidity",
      label: "السيولة",
      score: liquidity.score,
      baseWeight: 0.15,
      available: liquidity.available,
      note: "النسبة الحالية والسريعة والنقدية.",
    },
    {
      key: "leverage",
      label: "الرافعة المالية",
      score: leverage.score,
      baseWeight: 0.2,
      available: leverage.available,
      note: "نسبة الالتزامات إلى الأصول والدين إلى حقوق الملكية.",
    },
    {
      key: "profitability",
      label: "الربحية",
      score: profitability.score,
      baseWeight: 0.15,
      available: profitability.available,
      note: "هامش صافي الربح والهامش التشغيلي والعائد على الأصول.",
    },
    {
      key: "debtService",
      label: "خدمة الدين",
      score: debtService.score,
      baseWeight: 0.2,
      available: ratios.dscr !== null,
      note:
        ratios.dscr !== null
          ? "CFADS مقارنة بخدمة الدين التعاقدية، مع تغطية الفوائد."
          : "غير محتسب لغياب جدول خدمة الدين التعاقدي وCFADS.",
    },
    {
      key: "cashFlow",
      label: "التدفق النقدي",
      score: cashFlow.score,
      baseWeight: 0.15,
      available: cashFlow.available,
      note: "التدفق التشغيلي مقارنة بالالتزامات والدين والتدفق الحر.",
    },
    {
      key: "distress",
      label: "مؤشر التعثر",
      score: distress,
      baseWeight: 0.15,
      available: distressAvailable,
      note: distressAvailable
        ? "Altman Z' الكامل للشركات الخاصة متضمناً الأرباح المبقاة."
        : "غير محتسب؛ لا تطبق حدود Altman على معادلة ناقصة.",
    },
  ];

  const availableWeight = definitions
    .filter((item) => item.available)
    .reduce((sum, item) => sum + item.baseWeight, 0);

  return definitions.map((item) => {
    const effectiveWeight =
      item.available && availableWeight > 0
        ? item.baseWeight / availableWeight
        : 0;
    return {
      key: item.key,
      label: item.label,
      score: item.available ? Math.round(item.score) : 0,
      weight: effectiveWeight,
      contribution: item.available
        ? roundTo(item.score * effectiveWeight, 2)
        : 0,
      note: item.note,
      available: item.available,
    };
  });
}

function weightedAvailable(
  items: Array<[number | null | undefined, number, number]>,
) {
  const available = items.filter(
    ([value]) =>
      value !== null && value !== undefined && Number.isFinite(value),
  );
  const weight = available.reduce((sum, [, , w]) => sum + w, 0);
  if (!weight) return { score: 0, available: false };
  return {
    score: available.reduce((sum, [, score, w]) => sum + score * w, 0) / weight,
    available: true,
  };
}

function scoreLinear(
  value: number | null | undefined,
  weak: number,
  strong: number,
  lowerIsBetter = false,
) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return 50;
  if (lowerIsBetter) {
    if (value <= strong) return 100;
    if (value >= weak) return 0;
    return clamp(100 - ((value - strong) / (weak - strong)) * 100, 0, 100);
  }
  if (value >= strong) return 100;
  if (value <= weak) return 0;
  return clamp(((value - weak) / (strong - weak)) * 100, 0, 100);
}

function weightedScore(items: Array<[number, number]>) {
  const weight = items.reduce((sum, [, w]) => sum + w, 0);
  if (!weight) return 50;
  return items.reduce((sum, [score, w]) => sum + score * w, 0) / weight;
}

/* ------------------------------------------------------------------ */
/* 4. Vision 2030 alignment — actual operational data + fallbacks      */
/* ------------------------------------------------------------------ */

const SECTOR_VISION_WEIGHTS: Record<string, number> =
  financialModel.sectorVisionWeights;

export function computeVision2030Score(
  sector: string,
  employeeCount?: number,
  ratios?: Ratios,
  impactProfile?: CompanyImpactProfile,
): Vision2030Score {
  const sectorWeight =
    SECTOR_VISION_WEIGHTS[sector] ?? SECTOR_VISION_WEIGHTS["أخرى"];
  const liquidityScore = scoreLinear(ratios?.currentRatio, 0.7, 2);
  const debtScore = scoreLinear(ratios?.debtRatio, 0.8, 0.3, true);
  const profitabilityScore = scoreLinear(ratios?.netProfitMargin, 0, 0.15);
  const cashFlowScore = scoreLinear(ratios?.operatingCashFlowRatio, 0.1, 1);
  const financialStability = Math.round(
    (liquidityScore + debtScore + profitabilityScore + cashFlowScore) / 4,
  );

  const employees = nullableNonNegative(
    impactProfile?.employeeCount ?? employeeCount,
  );
  const saudis = nullableNonNegative(impactProfile?.saudiEmployeeCount);
  const plannedJobs = nullableNonNegative(impactProfile?.plannedNewJobs);
  const localProcurement = nullablePercent(
    impactProfile?.localProcurementPercent,
  );
  const nonOilRevenue = nullablePercent(impactProfile?.nonOilRevenuePercent);
  const sustainabilityInput = nullablePercent(
    impactProfile?.sustainabilityScore,
  );

  const hasLocalization =
    employees !== null && employees > 0 && saudis !== null;
  const localization = hasLocalization
    ? clamp(Math.round((saudis! / employees!) * 100), 0, 100)
    : clamp(
        Math.round(sectorWeight * 0.55 + financialStability * 0.45),
        0,
        100,
      );

  const hasNonOil = nonOilRevenue !== null || localProcurement !== null;
  const nonOilContribution = hasNonOil
    ? Math.round(
        nonOilRevenue !== null && localProcurement !== null
          ? nonOilRevenue * 0.7 + localProcurement * 0.3
          : (nonOilRevenue ?? localProcurement ?? 0),
      )
    : clamp(
        Math.round(
          sectorWeight * 0.7 + profitabilityScore * 0.2 + debtScore * 0.1,
        ),
        0,
        100,
      );

  const hasSustainability = sustainabilityInput !== null;
  const sustainability = hasSustainability
    ? clamp(
        Math.round(
          sustainabilityInput! * 0.75 + cashFlowScore * 0.15 + debtScore * 0.1,
        ),
        0,
        100,
      )
    : clamp(
        Math.round(
          sectorWeight * 0.35 + cashFlowScore * 0.4 + debtScore * 0.25,
        ),
        0,
        100,
      );

  const hasJobs = employees !== null && plannedJobs !== null;
  const jobCreation = hasJobs
    ? clamp(
        Math.round(
          30 +
            (Math.min(plannedJobs! / Math.max(employees!, 1), 0.25) / 0.25) *
              70,
        ),
        0,
        100,
      )
    : clamp(
        Math.round(35 + financialStability * 0.35 + sectorWeight * 0.25),
        0,
        100,
      );

  const score = Math.round(
    localization * 0.25 +
      nonOilContribution * 0.3 +
      sustainability * 0.25 +
      jobCreation * 0.2,
  );

  const actualInputs = [
    employees,
    saudis,
    plannedJobs,
    localProcurement,
    nonOilRevenue,
    sustainabilityInput,
  ].filter((value) => value !== null).length;

  return {
    score,
    breakdown: {
      localization,
      nonOilContribution: clamp(nonOilContribution, 0, 100),
      sustainability,
      jobCreation,
    },
    details: {
      methodology:
        "تستخدم بيانات الموظفين والسعودة والوظائف الجديدة والمشتريات المحلية والإيرادات غير النفطية والاستدامة عند إدخالها؛ وإلا تستخدم تقديراً معلناً من القطاع والاستقرار المالي.",
      sectorWeight,
      financialStability,
      dataQuality: Math.round((actualInputs / 6) * 100),
      actualInputsUsed: actualInputs,
      totalPossibleInputs: 6,
      isEstimated: actualInputs < 6,
      missingInputs: [
        employees === null ? "إجمالي عدد الموظفين" : null,
        saudis === null ? "عدد الموظفين السعوديين" : null,
        plannedJobs === null ? "الوظائف الجديدة المخطط لها" : null,
        localProcurement === null ? "نسبة المشتريات المحلية" : null,
        nonOilRevenue === null ? "نسبة الإيرادات غير النفطية" : null,
        sustainabilityInput === null ? "درجة الاستدامة" : null,
      ].filter((value): value is string => Boolean(value)),
      note:
        actualInputs < 6
          ? "تحليل رؤية 2030 افتراضي/تقديري لعدم إدخال جميع بيانات الأثر المطلوبة، ولا يعد قياساً فعلياً كاملاً."
          : "تحليل رؤية 2030 مبني على بيانات الأثر الفعلية المدخلة بالكامل.",
      sources: {
        localization: hasLocalization ? "actual" : "estimated",
        nonOilContribution: hasNonOil ? "actual" : "estimated",
        sustainability: hasSustainability ? "actual" : "estimated",
        jobCreation: hasJobs ? "actual" : "estimated",
      },
    },
  };
}

/* ------------------------------------------------------------------ */
/* 5. Funding recommendation — multi-capacity credit policy            */
/* ------------------------------------------------------------------ */

export function computeFundingRecommendation(
  f: ExtractedFinancials,
  ratios: Ratios,
  risk: RiskScore,
  _scoring?: Record<string, unknown>,
): FundingRecommendation {
  const targetDscr =
    risk.riskLevel === "low" ? 1.35 : risk.riskLevel === "medium" ? 1.5 : 1.75;
  const recommendedTermMonths =
    risk.riskLevel === "low" ? 60 : risk.riskLevel === "medium" ? 48 : 36;

  const policyReferenceRate = 4;
  const debtPremium = Math.max((ratios.debtRatio ?? 0.45) - 0.45, 0) * 5;
  const coveragePremium =
    ratios.interestCoverage !== null && ratios.interestCoverage < 3 ? 0.75 : 0;
  const riskPremium = roundTo(
    clamp(
      1.25 + risk.defaultProbability * 0.07 + debtPremium + coveragePremium,
      1,
      9,
    ),
    2,
  );
  const interestRate = roundTo(
    clamp(policyReferenceRate + riskPremium, 5, 14),
    2,
  );

  const missingBankingInputs: string[] = [];
  if (ratios.cfads === null)
    missingBankingInputs.push(
      "CFADS أو التدفق التشغيلي مع الإنفاق الرأسمالي الضروري",
    );
  if (f.scheduledPrincipal === null)
    missingBankingInputs.push("أصل الدين المجدول خلال الفترة");
  if (f.scheduledInterest === null)
    missingBankingInputs.push("الفوائد/الأرباح المجدولة خلال الفترة");
  if (f.mandatoryDebtFees === null)
    missingBankingInputs.push(
      "رسوم خدمة الدين الإلزامية (أدخل 0 عند عدم وجودها)",
    );
  if (f.financeLeasePayments === null)
    missingBankingInputs.push("دفعات الإيجار التمويلي (أدخل 0 عند عدم وجودها)");

  // قيمة خدمة الدين = صفر حالة صحيحة عندما لا توجد التزامات قائمة. لذلك
  // لا نشترط أن تكون أكبر من صفر لإصدار توصية؛ يكفي اكتمال الحقول.
  const debtServiceDataComplete =
    ratios.cfads !== null &&
    ratios.contractualDebtService !== null &&
    ratios.contractualDebtService >= 0 &&
    missingBankingInputs.length === 0;
  const existingAnnualDebtService = debtServiceDataComplete
    ? ratios.contractualDebtService
    : null;
  const availableAnnualDebtService = debtServiceDataComplete
    ? Math.max(
        (ratios.cfads as number) / targetDscr -
          (existingAnnualDebtService as number),
        0,
      )
    : null;
  const maxAffordableInstallment =
    availableAnnualDebtService === null
      ? null
      : Math.round(availableAnnualDebtService / 12);
  const cashFlowCapacity =
    maxAffordableInstallment !== null
      ? presentValueFromPayment(
          maxAffordableInstallment,
          interestRate / 100,
          recommendedTermMonths,
        )
      : null;

  const netAssets =
    f.totalAssets !== null && f.totalLiabilities !== null
      ? Math.max(f.totalAssets - f.totalLiabilities, 0)
      : null;
  const assetMultiplier =
    risk.riskLevel === "low" ? 0.7 : risk.riskLevel === "medium" ? 0.5 : 0.3;
  const assetBackedCapacity =
    netAssets !== null ? Math.max(netAssets * assetMultiplier, 0) : null;

  const maxProFormaDebtRatio =
    risk.riskLevel === "low" ? 0.65 : risk.riskLevel === "medium" ? 0.6 : 0.55;
  const leverageCapacity =
    f.totalAssets !== null && f.totalLiabilities !== null
      ? Math.max(
          (maxProFormaDebtRatio * f.totalAssets - f.totalLiabilities) /
            (1 - maxProFormaDebtRatio),
          0,
        )
      : null;

  const revenueMultiplier =
    risk.riskLevel === "low" ? 0.25 : risk.riskLevel === "medium" ? 0.18 : 0.1;
  const revenueCapacity =
    f.revenue !== null ? Math.max(f.revenue * revenueMultiplier, 0) : null;

  const bankGradeCapacities = [
    { label: "قدرة السداد من CFADS", value: cashFlowCapacity },
    { label: "حد صافي الأصول", value: assetBackedCapacity },
    { label: "حد المديونية بعد التمويل", value: leverageCapacity },
    { label: "حد نسبة التمويل إلى الإيرادات", value: revenueCapacity },
  ].filter(
    (item): item is { label: string; value: number } =>
      item.value !== null && Number.isFinite(item.value),
  );

  const statementCapacities = [
    { label: "حد صافي الأصول", value: assetBackedCapacity },
    { label: "حد المديونية بعد التمويل", value: leverageCapacity },
    { label: "حد نسبة التمويل إلى الإيرادات", value: revenueCapacity },
  ].filter(
    (item): item is { label: string; value: number } =>
      item.value !== null && Number.isFinite(item.value) && item.value > 0,
  );

  const preliminaryPrudenceFactor =
    risk.riskLevel === "low" ? 0.6 : risk.riskLevel === "medium" ? 0.45 : 0.3;
  const bankGradeBinding = bankGradeCapacities.length
    ? bankGradeCapacities.reduce((lowest, item) =>
        item.value < lowest.value ? item : lowest,
      )
    : null;
  const preliminaryBinding = statementCapacities.length
    ? statementCapacities.reduce((lowest, item) =>
        item.value < lowest.value ? item : lowest,
      )
    : null;
  const binding = debtServiceDataComplete
    ? bankGradeBinding
    : preliminaryBinding;
  const rawCapacity = debtServiceDataComplete
    ? binding?.value || 0
    : (binding?.value || 0) * preliminaryPrudenceFactor;
  const amount = Math.max(Math.floor(rawCapacity / 50_000) * 50_000, 0);
  const isPreliminary = !debtServiceDataComplete;

  const estimatedMonthlyInstallment =
    amount > 0
      ? Math.round(
          monthlyPayment(amount, interestRate / 100, recommendedTermMonths),
        )
      : 0;
  const totalAnnualDebtService =
    existingAnnualDebtService === null
      ? null
      : existingAnnualDebtService + estimatedMonthlyInstallment * 12;
  const dscrAfterFinancing =
    totalAnnualDebtService !== null &&
    totalAnnualDebtService > 0 &&
    ratios.cfads !== null
      ? round(ratios.cfads / totalAnnualDebtService, 2)
      : null;

  const eligibility: FundingRecommendation["eligibility"] =
    !debtServiceDataComplete
      ? "committee_review"
      : amount > 0 &&
          risk.riskLevel === "low" &&
          dscrAfterFinancing !== null &&
          dscrAfterFinancing >= targetDscr
        ? "eligible"
        : amount > 0 &&
            risk.riskLevel !== "high" &&
            dscrAfterFinancing !== null &&
            dscrAfterFinancing >= 1.15
          ? "conditional"
          : "committee_review";

  const recommendationText = !debtServiceDataComplete
    ? amount > 0
      ? "تقدير تمويلي أولي متحفظ من القوائم المالية؛ يصبح نهائياً بعد إدخال CFADS وجدول خدمة الدين ومراجعة البنك"
      : "تعذر تكوين حد تمويلي موجب من القوائم الحالية؛ يلزم استكمال بيانات خدمة الدين ومراجعة البنك"
    : eligibility === "eligible"
      ? "مؤهل مبدئياً ضمن حد القدرة الأدنى وبشرط التحقق الائتماني والضمانات"
      : eligibility === "conditional"
        ? "تمويل مشروط بخفض المخاطر أو تعزيز الضمانات والمحافظة على DSCR المستهدف"
        : "يتطلب مراجعة لجنة الائتمان؛ القدرة الحالية لا تدعم موافقة آلية";

  const requiredCoverageRatio =
    amount > 0
      ? requiredCollateralCoverageRatio({
          riskLevel: risk.riskLevel,
          defaultProbability: risk.defaultProbability,
          dscr: dscrAfterFinancing ?? ratios.dscr,
          debtRatio: ratios.debtRatio,
          applicantType: "company",
        })
      : 0;
  const requiredEligibleValue = Math.round(amount * requiredCoverageRatio);

  return {
    amount,
    interestRate,
    recommendationText,
    recommendedTermMonths,
    estimatedMonthlyInstallment,
    dscrAfterFinancing,
    maxAffordableInstallment,
    eligibility,
    isPreliminary,
    collateral: {
      requiredCoverageRatio,
      requiredEligibleValue,
      methodology:
        "قيمة الضمان المطلوبة = مبلغ التمويل × نسبة التغطية. تبدأ النسبة من 65% للمخاطر المنخفضة، 90% للمتوسطة، و115% للمرتفعة، ثم تعدل باحتمال التعثر وDSCR والمديونية، وتثبت نهائياً بعد تقييم الضمان والتحقق القانوني.",
    },
    basis: debtServiceDataComplete
      ? "المبلغ هو أصغر حد بين قدرة السداد من CFADS، وصافي الأصول، وحد المديونية بعد التمويل، وحد التمويل إلى الإيرادات."
      : `تقدير أولي: أصغر حد متاح من صافي الأصول والمديونية والإيرادات بعد تطبيق هامش تحفظ ${(preliminaryPrudenceFactor * 100).toFixed(0)}%. لا يمثل موافقة ائتمانية قبل اكتمال DSCR.`,
    calculation: {
      targetDscr,
      existingAnnualDebtService:
        existingAnnualDebtService === null
          ? null
          : Math.round(existingAnnualDebtService),
      availableAnnualDebtService:
        availableAnnualDebtService === null
          ? null
          : Math.round(availableAnnualDebtService),
      cfads: ratios.cfads === null ? null : Math.round(ratios.cfads),
      debtServiceDataComplete,
      missingBankingInputs,
      recommendationMode: debtServiceDataComplete
        ? "bank_grade"
        : "preliminary_statements",
      preliminaryPrudenceFactor: debtServiceDataComplete
        ? undefined
        : preliminaryPrudenceFactor,
      cashFlowCapacity:
        cashFlowCapacity === null ? null : Math.round(cashFlowCapacity),
      assetBackedCapacity:
        assetBackedCapacity === null ? null : Math.round(assetBackedCapacity),
      leverageCapacity:
        leverageCapacity === null ? null : Math.round(leverageCapacity),
      revenueCapacity:
        revenueCapacity === null ? null : Math.round(revenueCapacity),
      bindingConstraint: binding
        ? debtServiceDataComplete
          ? binding.label
          : `${binding.label} بعد هامش التحفظ`
        : "لا توجد قدرة تمويلية موجبة من البيانات الحالية",
      policyReferenceRate,
      riskPremium,
    },
  };
}

function monthlyPayment(
  principal: number,
  annualRate: number,
  months: number,
): number {
  if (principal <= 0 || months <= 0) return 0;
  const monthlyRate = annualRate / 12;
  if (monthlyRate === 0) return principal / months;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

function presentValueFromPayment(
  monthlyPaymentAmount: number,
  annualRate: number,
  months: number,
) {
  if (monthlyPaymentAmount <= 0 || months <= 0) return 0;
  const monthlyRate = annualRate / 12;
  if (monthlyRate === 0) return monthlyPaymentAmount * months;
  return (
    monthlyPaymentAmount *
    ((1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate)
  );
}

function nullablePercent(value: unknown): number | null {
  const n = toNullableNumber(value);
  return n === null ? null : clamp(n, 0, 100);
}

function nullableNonNegative(value: unknown): number | null {
  const n = toNullableNumber(value);
  return n === null ? null : Math.max(n, 0);
}

function roundTo(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/* ------------------------------------------------------------------ */
/* 6. Industry benchmarks and comparison                               */
/* ------------------------------------------------------------------ */

const BENCHMARKS: Record<string, IndustryBenchmark> = financialModel.benchmarks;

export function getIndustryBenchmark(sector: string): IndustryBenchmark {
  return BENCHMARKS[sector] ?? BENCHMARKS["أخرى"];
}

export function compareWithIndustry(
  ratios: Ratios,
  benchmark: IndustryBenchmark,
): SectorComparisonMetric[] {
  return [
    buildComparison(
      "نسبة السيولة",
      ratios.currentRatio,
      benchmark.liquidityRatio,
      false,
    ),
    buildComparison(
      "نسبة المديونية",
      ratios.debtRatio,
      benchmark.debtRatio,
      true,
    ),
    buildComparison(
      "هامش الربح",
      ratios.netProfitMargin,
      benchmark.profitMargin,
      false,
    ),
  ];
}

function buildComparison(
  label: string,
  company: number | null,
  sectorAverage: number,
  lowerIsBetter: boolean,
): SectorComparisonMetric {
  if (company === null) {
    return {
      label,
      company,
      sectorAverage,
      direction: "neutral",
      note: "غير متوفر بسبب نقص قيمة المؤشر.",
    };
  }

  const better = lowerIsBetter
    ? company <= sectorAverage
    : company >= sectorAverage;
  return {
    label,
    company,
    sectorAverage,
    direction: better ? "better" : "worse",
    note: better ? "أفضل من متوسط القطاع" : "أقل من متوسط القطاع ويحتاج متابعة",
  };
}

export const SECTORS = Object.keys(SECTOR_VISION_WEIGHTS);

/* ------------------------------------------------------------------ */
/* Utils                                                               */
/* ------------------------------------------------------------------ */

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value.replace(/[, ]/g, "").trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
