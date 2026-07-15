// Shared type definitions used across the app and API routes.

export type RiskLevel = "low" | "medium" | "high";

export interface ExtractedFinancials {
  // Balance Sheet
  totalAssets: number | null;
  currentAssets: number | null;
  cash: number | null;
  inventory: number | null;
  accountsReceivable: number | null;
  totalLiabilities: number | null;
  currentLiabilities: number | null;
  shortTermDebt: number | null;
  longTermDebt: number | null;
  equity: number | null;
  retainedEarnings: number | null;

  // Income Statement
  revenue: number | null;
  costOfGoodsSold: number | null;
  grossProfit: number | null;
  operatingExpenses: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  interestExpense: number | null;
  zakatTax: number | null;
  depreciation: number | null;
  amortization: number | null;

  // Cash Flow Statement
  operatingCashFlow: number | null;
  investingCashFlow: number | null;
  financingCashFlow: number | null;
  netCashFlow: number | null;
  endingCashBalance: number | null;

  // Bank-grade debt-service / CFADS inputs (optional for ratio analysis,
  // mandatory before an automatic credit recommendation can be issued).
  cfads: number | null;
  maintenanceCapex: number | null;
  scheduledPrincipal: number | null;
  scheduledInterest: number | null;
  mandatoryDebtFees: number | null;
  financeLeasePayments: number | null;
}

export interface Ratios {
  // Main dashboard aliases mapped directly from processed metrics
  liquidityRatio: number | null; // current_ratio
  debtRatio: number | null; // debt_ratio
  profitMargin: number | null; // net_profit_margin
  cashFlow: number | null; // operating_cash_flow_ratio
  zScore: number | null; // altman_z_score

  // Full processed metrics
  currentRatio: number | null;
  quickRatio: number | null;
  cashRatio: number | null;
  workingCapital: number | null;
  debtToEquity: number | null;
  equityRatio: number | null;
  grossProfitMargin: number | null;
  operatingMargin: number | null;
  netProfitMargin: number | null;
  roa: number | null;
  roe: number | null;
  ebit: number | null; // الربح قبل الفوائد والضرائب (الربح التشغيلي)
  ebitMargin: number | null;
  // EBITDA الحقيقي متاح فقط عندما يوفر الملف قيم الإهلاك/الاستهلاك في الـ pipeline
  ebitda: number | null;
  ebitdaMargin: number | null;
  interestCoverage: number | null;
  dscr: number | null;
  cfads: number | null;
  contractualDebtService: number | null;
  dscrMethod:
    "cfads_contractual" | "ocf_less_maintenance_capex" | "unavailable";
  bankingDataQuality: number;
  operatingCashFlowRatio: number | null;
  operatingCashFlowToDebt: number | null;
  freeCashFlow: number | null;
  assetTurnover: number | null;
  inventoryTurnover: number | null;
  receivablesTurnover: number | null;
  altmanModel?: "private_full" | "unavailable" | string | null;
}

export interface RiskScoreComponent {
  key:
    | "liquidity"
    | "leverage"
    | "profitability"
    | "debtService"
    | "cashFlow"
    | "distress";
  label: string;
  score: number;
  weight: number;
  contribution: number;
  note: string;
  available?: boolean;
}

export interface RiskScore {
  defaultProbability: number; // 12-month estimated PD, 0-100
  riskLevel: RiskLevel;
  healthScore?: number; // 0-100, higher = healthier
  components?: RiskScoreComponent[];
  methodology?: string;
  probabilityMethodology?: string;
  modelVersion?: string;
  modelStatus?: "provisional" | "validated";
  regulatoryUseAllowed?: boolean;
  missingModelInputs?: string[];
}

export interface CompanyImpactProfile {
  employeeCount?: number | null;
  saudiEmployeeCount?: number | null;
  plannedNewJobs?: number | null;
  localProcurementPercent?: number | null;
  nonOilRevenuePercent?: number | null;
  sustainabilityScore?: number | null;
}

export interface Vision2030Score {
  score: number; // 0-100
  breakdown: {
    localization: number;
    nonOilContribution: number;
    sustainability: number;
    jobCreation: number;
  };
  details?: {
    methodology: string;
    sectorWeight: number;
    financialStability: number;
    dataQuality?: number;
    actualInputsUsed?: number;
    totalPossibleInputs?: number;
    isEstimated?: boolean;
    missingInputs?: string[];
    note?: string;
    sources?: {
      localization: "actual" | "estimated";
      nonOilContribution: "actual" | "estimated";
      sustainability: "actual" | "estimated";
      jobCreation: "actual" | "estimated";
    };
  };
}

export interface FundingRecommendation {
  amount: number;
  interestRate: number;
  recommendationText: string;
  recommendedTermMonths?: number;
  estimatedMonthlyInstallment?: number;
  dscrAfterFinancing?: number | null;
  maxAffordableInstallment?: number | null;
  eligibility?: "eligible" | "conditional" | "committee_review";
  basis?: string;
  isPreliminary?: boolean;
  collateral?: {
    requiredCoverageRatio: number;
    requiredEligibleValue: number;
    methodology: string;
  };
  calculation?: {
    targetDscr: number;
    existingAnnualDebtService: number | null;
    availableAnnualDebtService: number | null;
    cfads: number | null;
    debtServiceDataComplete: boolean;
    missingBankingInputs: string[];
    recommendationMode?: "bank_grade" | "preliminary_statements";
    preliminaryPrudenceFactor?: number;
    cashFlowCapacity: number | null;
    assetBackedCapacity: number | null;
    leverageCapacity: number | null;
    revenueCapacity: number | null;
    bindingConstraint: string;
    policyReferenceRate: number;
    riskPremium: number;
  };
}

export type FinancingJourneyStatus =
  | "draft"
  | "submitted"
  | "data_review"
  | "analysis_completed"
  | "bank_review"
  | "conditional_approval"
  | "guarantee_required"
  | "approved"
  | "rejected"
  | "disbursed"
  | "monitoring"
  | "warning"
  | "restructured"
  | "closed"
  | "defaulted"
  | "pending"
  | "under_review";

export interface FinancingJourneyStage {
  key: FinancingJourneyStatus;
  label: string;
  description: string;
  state: "completed" | "current" | "pending" | "blocked";
  completedAt?: string;
}

export interface FinancingGuaranteeItem {
  type:
    | "personal"
    | "asset_pledge"
    | "kafalah"
    | "receivables_assignment"
    | "promissory_note";
  label: string;
  required: boolean;
  estimatedValue: number;
  status: "not_requested" | "requested" | "submitted" | "accepted" | "rejected";
  note: string;
}

export interface FinancingGuaranteePlan {
  requiredAmount: number;
  coverageRatio: number;
  recommendedType: string;
  status:
    | "not_required"
    | "required"
    | "pending_submission"
    | "accepted"
    | "rejected";
  items: FinancingGuaranteeItem[];
  notes: string[];
}

export type CollateralType =
  | "cash_deposit"
  | "bank_guarantee"
  | "kafalah"
  | "real_estate"
  | "equipment"
  | "vehicle"
  | "inventory"
  | "receivables"
  | "corporate_guarantee"
  | "personal_guarantee"
  | "promissory_note";

export type CollateralAssetStatus =
  | "recommended"
  | "requested"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "perfection_pending"
  | "perfected"
  | "active"
  | "released"
  | "enforcement"
  | "liquidated";

export type CollateralPackageStatus =
  | "draft"
  | "recommended"
  | "awaiting_submission"
  | "under_review"
  | "approved"
  | "perfection_pending"
  | "active"
  | "shortfall"
  | "enforcement"
  | "released";

export interface CollateralRecommendationOption {
  type: CollateralType;
  label: string;
  suitabilityScore: number;
  estimatedAvailableValue: number;
  expectedHaircut: number;
  estimatedEligibleValue: number;
  maximumCoverageShare: number;
  mandatory: boolean;
  reasons: string[];
  requiredDocuments: string[];
  caveats: string[];
}

export interface CollateralDocument {
  id: string;
  type:
    | "ownership"
    | "valuation"
    | "insurance"
    | "registration"
    | "assignment"
    | "guarantee_letter"
    | "promissory_note"
    | "financial_statement"
    | "other";
  name: string;
  reference?: string;
  storageKey?: string;
  mimeType?: string;
  size?: number;
  uploadedAt: string;
  uploadedBy?: string;
  uploadedByType?: "bank" | "company";
  status: "pending" | "verified" | "rejected";
  verifiedAt?: string;
  verifiedBy?: string;
  note?: string;
}

export interface CollateralValuation {
  marketValue: number;
  forcedSaleValue: number | null;
  valuationDate?: string;
  expiryDate?: string;
  valuer?: string;
  source: "system_estimate" | "client_declared" | "independent_valuation";
  currency: "SAR";
  realisationCosts?: number;
  timeToRealiseMonths?: number;
  discountRate?: number;
  netRealizableValue?: number;
  presentValueOfRecovery?: number;
  nextRevaluationDate?: string;
}

export interface CollateralAsset {
  id: string;
  type: CollateralType;
  label: string;
  description: string;
  ownerName: string;
  ownerType: "company" | "shareholder" | "third_party";
  identifier?: string;
  source: "recommendation" | "manual";
  mandatory: boolean;
  status: CollateralAssetStatus;
  lienRank: "first" | "second" | "unsecured";
  haircut: number;
  maximumCoverageShare: number;
  valuation: CollateralValuation;
  eligibleValue: number;
  cappedEligibleValue: number;
  concentrationGroup?: string;
  documents: CollateralDocument[];
  checks: {
    ownershipVerified: boolean;
    encumbranceChecked: boolean;
    valuationVerified: boolean;
    insuranceVerified: boolean;
    legalPerfectionVerified: boolean;
  };
  conditions: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollateralEnforcementEvent {
  id: string;
  createdAt: string;
  type: "notice" | "demand" | "seizure" | "sale" | "settlement" | "recovery";
  amount?: number;
  note: string;
  actorName: string;
}

export interface CollateralPackage {
  version: string;
  status: CollateralPackageStatus;
  approvedFinancingAmount: number;
  requiredCoverageRatio: number;
  requiredEligibleValue: number;
  currentEligibleValue: number;
  coverageRatio: number;
  shortfall: number;
  recommendations: CollateralRecommendationOption[];
  assets: CollateralAsset[];
  concentrationWarnings: string[];
  missingRequirements: string[];
  allMandatoryApproved: boolean;
  allMandatoryPerfected: boolean;
  readyForActivation: boolean;
  disbursementEligible: boolean;
  submittedAt?: string;
  submittedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  activatedAt?: string;
  activatedBy?: string;
  releasedAt?: string;
  releasedBy?: string;
  enforcementEvents: CollateralEnforcementEvent[];
  lastCalculatedAt: string;
  methodology: string;
  policyVersion?: string;
  expectedRecoveryAmount?: number;
  recoveryRate?: number;
  lossGivenDefault?: number;
}

export interface MonthlyMonitoringPlan {
  approvedAmount: number;
  disbursedAmount: number;
  remainingUndisbursedAmount: number;
  monthlyInstallment: number;
  firstInstallmentDate: string;
  lastInstallmentDate: string;
  paymentStatus:
    | "not_started"
    | "on_time"
    | "late_one_installment"
    | "late_two_installments"
    | "restructured"
    | "defaulted"
    | "closed";
  paidInstallments: number;
  remainingInstallments: number;
  latestFinancialUpdate: string;
  nextReviewDate: string;
  currentRiskLevel: RiskLevel;
  earlyWarningScore: number;
  earlyWarningAlerts: string[];
  earlyWarningComponents?: {
    label: string;
    score: number;
    weight: number;
    contribution: number;
  }[];
  earlyWarningMethodology?: string;
}

export interface FundingProtectionPlan {
  fundingAmount: number;
  guaranteeValue: number;
  guaranteeCoverageRatio: number;
  defaultProbability: number;
  expectedRecoveryRate: number;
  expectedRecoveryAmount: number;
  expectedLoss: number;
  exposureAtDefault: number;
  mitigationActions: string[];
}

export interface FinancingLifecyclePlan {
  status: FinancingJourneyStatus;
  statusLabel: string;
  stages: FinancingJourneyStage[];
  guaranteePlan: FinancingGuaranteePlan;
  monitoringPlan: MonthlyMonitoringPlan;
  protectionPlan: FundingProtectionPlan;
  nextActions: string[];
  methodology: string;
}

export interface IndustryBenchmark {
  liquidityRatio: number;
  debtRatio: number;
  profitMargin: number;
}

export interface SectorComparisonMetric {
  label: string;
  company: number | null;
  sectorAverage: number;
  direction: "better" | "worse" | "neutral";
  note: string;
}

export interface CompanyAnalysisInput {
  companyName: string;
  sector: string;
  city: string;
  financials: ExtractedFinancials;
  sourceMethod: "upload" | "manual";
  impactProfile?: CompanyImpactProfile;
}

export interface AnalysisAudit {
  metricsVerified: boolean;
  formulasVersion: string;
  checkedAt: string;
  issues: string[];
  correctedMetricKeys?: string[];
}

export interface AnalysisDataSufficiency {
  coreFinancials: {
    requiredCount: 23;
    complete: boolean;
    missingFields: string[];
    status: "complete" | "missing";
    note: string;
  };
  supplemental: {
    providedFields: string[];
    missingFields: string[];
    status: "complete" | "partial" | "not_provided";
    note: string;
  };
  vision2030: {
    isEstimated: boolean;
    missingInputs: string[];
    note: string;
  };
  altman: {
    isAccurate: boolean;
    missingInputs: string[];
    note: string;
  };
}

export interface CompanyReportData {
  /** Internal authorization metadata; stripped before API responses. */
  _accessControl?: { ownerCompanyId?: string };
  /** Short human-friendly reference number shown to the user (e.g. "48213"). */
  referenceNumber?: string;
  companyName: string;
  sector: string;
  city: string;
  financials: ExtractedFinancials;
  impactProfile?: CompanyImpactProfile;
  ratios: Ratios;
  risk: RiskScore;
  vision2030: Vision2030Score;
  funding: FundingRecommendation;
  financingLifecycle?: FinancingLifecyclePlan;
  benchmark: IndustryBenchmark;
  sectorComparison?: SectorComparisonMetric[];
  analysisAudit?: AnalysisAudit;
  dataSufficiency?: AnalysisDataSufficiency;
  elt?: {
    status: string;
    message: string;
    validation?: unknown;
    logicValidation?: {
      logic_valid?: boolean;
      issues?: string[];
      warnings?: string[];
    };
    processedFile?: string;
  };
  narrative: string;
}

export interface StartupAnalysisInput {
  projectName: string;
  ideaDescription: string;
  sector: string;
  city: string;
  currentCapital: number;
  expectedBudget: number;
  employeeCount: number;
  goals: string;
  revenueSources: string;
  expenses: string;
  targetAudience: string;
}

export interface SwotAnalysis {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface RoadmapPhase {
  title: string;
  timeframe: string;
  items: string[];
}

export interface StartupReportData {
  /** Internal authorization metadata; stripped before API responses. */
  _accessControl?: { ownerCompanyId?: string };
  /** Short human-friendly reference number shown to the user (e.g. "48213"). */
  referenceNumber?: string;
  input: StartupAnalysisInput;
  feasible: boolean;
  successProbability: number; // 0-100
  vision2030: Vision2030Score;
  risks: string[];
  recommendedCapital: number;
  fundingNeeded: number;
  paybackMonths: number;
  fundingSources: string[];
  swot: SwotAnalysis;
  roadmap: RoadmapPhase[];
  narrative: string;
}

export type ReportType = "company" | "startup";

export interface StoredReport {
  id: string;
  type: ReportType;
  createdAt: string;
  data: CompanyReportData | StartupReportData;
}

/* ------------------------------------------------------------------ */
/* Financing request / bank matching                                   */
/* ------------------------------------------------------------------ */

export interface Bank {
  id: string;
  name: string; // Arabic display name
  minRate: number;
  maxRate: number;
  strengths: string; // short Arabic description
}

export interface PartnerBankQuote {
  bank: Bank;
  estimatedRate: number;
  notes: string[]; // Arabic, short context notes for this specific applicant
}

export interface FinancingRequestInput {
  reportId: string;
  contactName: string;
  phone: string;
  email: string;
  requestedAmount: number;
  purpose: string;
  termMonths: number;
  notes: string;
  crNumber?: string;
  detailedActivity?: string;
  establishmentDate?: string;
  companyAgeYears?: number;
  ownerName?: string;
  ownerNationalId?: string;
}

export type FinancingRequestStatus = FinancingJourneyStatus;

export type BankRole =
  "admin" | "credit_analyst" | "risk_manager" | "operations" | "auditor";

export type BankPermission =
  | "view_dashboard"
  | "view_requests"
  | "submit_recommendation"
  | "final_decision"
  | "disburse"
  | "view_monitoring"
  | "add_monitoring"
  | "manage_users"
  | "view_audit"
  | "view_collateral"
  | "manage_collateral"
  | "approve_collateral"
  | "perfect_collateral"
  | "enforce_collateral";

export interface CommitteeApproval {
  role: "credit_analyst" | "risk_manager" | "authorized_officer";
  decision: "approve" | "conditional" | "reject";
  actorId: string;
  actorName: string;
  actorRole: BankRole;
  note?: string;
  createdAt: string;
}

export interface CreditCommitteeRecord {
  analyst?: CommitteeApproval;
  riskManager?: CommitteeApproval;
  authorizedOfficer?: CommitteeApproval;
  completedAt?: string;
}


export type CreditConditionStatus = "pending" | "submitted" | "verified" | "waived";

export interface CreditCondition {
  id: string;
  title: string;
  category: "document" | "collateral" | "financial" | "legal" | "other";
  required: boolean;
  status: CreditConditionStatus;
  note?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface CreditCalculationOverrides {
  requestedAmountOverride?: number;
  termMonthsOverride?: number;
  maximumDebtRatioPercent?: number;
  requiredCollateralCoveragePercent?: number;
  targetDscr?: number;
  policyReferenceRate?: number;
  riskPremium?: number;
  cashFlowCapacity?: number | null;
  assetBackedCapacity?: number | null;
  leverageCapacity?: number | null;
  revenueCapacity?: number | null;
  analystRecommendedAmount?: number;
  analystRecommendedRate?: number;
  note?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface BankCreditReview {
  priority: "normal" | "high" | "urgent";
  assignedTo?: string;
  analystRecommendation?: "approve" | "conditional" | "reject";
  recommendedAmount?: number;
  recommendedRate?: number;
  recommendedTermMonths?: number;
  conditions?: string[];
  conditionChecklist?: CreditCondition[];
  preliminaryDecisionBy?: string;
  preliminaryDecisionAt?: string;
  calculationOverrides?: CreditCalculationOverrides;
  riskOpinion?: string;
  rationale?: string;
  recommendationBy?: string;
  recommendationAt?: string;
  finalDecision?: "approved" | "conditional" | "rejected";
  approvedAmount?: number;
  approvedRate?: number;
  approvedTermMonths?: number;
  finalDecisionBy?: string;
  finalDecisionAt?: string;
  committee?: CreditCommitteeRecord;
}

export interface BankAuditEvent {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  actorRole?: BankRole;
  actorType?: "bank" | "company" | "system";
  createdAt: string;
  details: string;
}

export type ApplicationDocumentType =
  | "financial_statements"
  | "bank_statement_6m"
  | "commercial_registration"
  | "authorized_signatory_id"
  | "fund_use_plan"
  | "feasibility_study"
  | "company_profile"
  | "other";

export interface FinancingRequestFile {
  id: string;
  kind: "company_pdf" | "attachment" | "monitoring_statement";
  documentType?: ApplicationDocumentType;
  displayLabel?: string;
  required?: boolean;
  verificationStatus?: "pending" | "verified" | "rejected";
  originalName: string;
  storedName: string;
  path: string;
  storage?: "local" | "database";
  storageKey?: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface TicketHistoryEntry {
  status: FinancingRequestStatus;
  note: string;
  updatedAt: string;
  actor: "system" | "bank" | "company";
  actorName?: string;
  actorRole?: BankRole;
}

export interface TicketSecurity {
  otpSalt: string;
  otpHash: string;
  otpCreatedAt: string;
  otpExpiresAt: string;
  otpAttemptCount: number;
  otpMaxAttempts: number;
  otpVerifiedAt?: string;
}

export interface TicketMetadata {
  ticketNumber?: string;
  inquiryNumber?: string;
  submissionDate?: string;
  lastUpdate?: string;
  submissionMode?: "pdf" | "manual";
  pdfExtractionWarnings?: string[];
  emailDelivery?: {
    status: "sent" | "skipped" | "failed";
    to?: string;
    message?: string;
    at: string;
  };
}

export type MonitoringStatus = "healthy" | "watch" | "high_risk" | "default";
export type CreditStage = "stage1" | "stage2" | "stage3";

export interface MonitoringSnapshot {
  id: string;
  period: string; // YYYY-MM
  submittedAt: string;
  revenue: number;
  operatingCashFlow: number;
  maintenanceCapex: number;
  cfads: number;
  totalDebt: number;
  currentAssets: number;
  currentLiabilities: number;
  scheduledPrincipal: number;
  scheduledInterest: number;
  mandatoryDebtFees: number;
  financeLeasePayments: number;
  contractualDebtService: number;
  annualDebtService: number; // compatibility alias = contractualDebtService
  installmentDue: number;
  installmentPaid: number;
  daysPastDue: number;
  currentRatio: number;
  debtRatio: number;
  dscr: number;
  dscrMethod: "cfads_contractual";
  revenueChange: number | null;
  cashFlowChange: number | null;
  healthScore: number;
  probabilityOfDefault: number;
  probabilityModelStatus: "uncalibrated" | "validated";
  regulatoryUseAllowed: boolean;
  earlyWarningScore: number;
  creditStage: CreditStage;
  stageReasons: string[];
  status: MonitoringStatus;
  alerts: string[];
  recommendedActions: string[];
  expectedCreditLoss?: number | null;
  eclBasis?: "12_month" | "lifetime" | "credit_impaired";
  sourceFileName?: string;
  notes?: string;
}

export interface MonitoringAction {
  id: string;
  createdAt: string;
  title: string;
  owner: string;
  dueDate?: string;
  status: "open" | "in_progress" | "completed" | "cancelled";
  note?: string;
}

export interface FinancingMonitoring {
  cadence: "monthly" | "quarterly";
  nextSubmissionDate?: string;
  snapshots: MonitoringSnapshot[];
  actions: MonitoringAction[];
}

export interface CompanyApplicationProfile {
  crNumber: string;
  detailedActivity: string;
  establishmentDate?: string;
  companyAgeYears: number;
  city?: string;
}

export interface FinancingDisbursementRecord {
  id: string;
  amount: number;
  mode: "full" | "tranche";
  beneficiaryName: string;
  beneficiaryIban: string;
  beneficiaryBank: string;
  transferReference: string;
  disbursementDate: string;
  note?: string;
  recordedAt: string;
  recordedBy: string;
}

export interface FinancingInstallment {
  id: string;
  sequence: number;
  dueDate: string;
  principal: number;
  profit: number;
  amountDue: number;
  paidAmount: number;
  paidAt?: string;
  daysPastDue: number;
  status: "upcoming" | "due" | "partial" | "paid" | "late" | "waived";
}

export interface CollectionEvent {
  id: string;
  type: "payment_reminder" | "promise_to_pay" | "collection_referral" | "legal_notice" | "collateral_enforcement" | "collateral_sale" | "recovery" | "closure";
  createdAt: string;
  actorName: string;
  amount?: number;
  dueDate?: string;
  note: string;
}

export interface RestructuringPlan {
  id: string;
  createdAt: string;
  actorName: string;
  reason: string;
  newAmount: number;
  newRate: number;
  newTermMonths: number;
  gracePeriodMonths: number;
  status: "proposed" | "approved" | "cancelled";
}

export interface FinancingOperations {
  disbursements: FinancingDisbursementRecord[];
  totalDisbursed: number;
  remainingUndisbursed: number;
  installments: FinancingInstallment[];
  collectionEvents: CollectionEvent[];
  restructuringPlans: RestructuringPlan[];
  totalRecovered: number;
  closedAt?: string;
  closureReason?: string;
}

export interface FinancingRequestRecord {
  input: FinancingRequestInput;
  ownerCompanyId?: string;
  /** Short human-friendly number shared with the report/analysis and used for inquiries. */
  referenceNumber?: string;
  applicantName: string;
  applicantType: "company" | "startup";
  sector: string;
  companyProfile?: CompanyApplicationProfile;
  bankQuote: PartnerBankQuote;
  status: FinancingRequestStatus;
  lifecycle?: FinancingLifecyclePlan;
  uploadedFiles?: FinancingRequestFile[];
  history?: TicketHistoryEntry[];
  security?: TicketSecurity;
  metadata?: TicketMetadata;
  monitoring?: FinancingMonitoring;
  operations?: FinancingOperations;
  creditReview?: BankCreditReview;
  collateral?: CollateralPackage;
  auditTrail?: BankAuditEvent[];
}

export interface BankUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role?: BankRole;
  department?: string;
  isActive?: boolean;
  mfaEnabled?: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface CompanyUser {
  id: string;
  crNumber: string;
  companyName: string;
  sector: string;
  detailedActivity?: string;
  establishmentDate?: string;
  companyAgeYears?: number;
  city: string;
  phone: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface StoredFileBlob {
  ticketId: string;
  fileId: string;
  originalName: string;
  mimeType: string;
  contentBase64: string;
  createdAt: string;
}

export interface StoredOutboxEmail {
  to: string;
  from: string;
  subject: string;
  rawMime: string;
  createdAt: string;
}

export interface StoredFinancingRequest {
  id: string;
  createdAt: string;
  data: FinancingRequestRecord;
}
