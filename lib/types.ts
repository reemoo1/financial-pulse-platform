// Shared type definitions used across the app and API routes.

export type RiskLevel = "low" | "medium" | "high";

export interface ExtractedFinancials {
  currentAssets: number;
  currentLiabilities: number;
  totalAssets: number;
  totalLiabilities: number;
  netIncome: number;
  revenue: number;
  operatingCashFlow: number;
}

export interface Ratios {
  liquidityRatio: number; // current assets / current liabilities
  debtRatio: number; // total liabilities / total assets
  profitMargin: number; // net income / revenue
  cashFlow: number; // operating cash flow (absolute, SAR)
  zScore: number;
}

export interface RiskScore {
  defaultProbability: number; // 0-100
  riskLevel: RiskLevel;
}

export interface Vision2030Score {
  score: number; // 0-100
  breakdown: {
    localization: number;
    nonOilContribution: number;
    sustainability: number;
    jobCreation: number;
  };
}

export interface FundingRecommendation {
  amount: number;
  interestRate: number;
  recommendationText: string;
}

export interface IndustryBenchmark {
  liquidityRatio: number;
  debtRatio: number;
  profitMargin: number;
}

export interface CompanyAnalysisInput {
  companyName: string;
  sector: string;
  city: string;
  financials: ExtractedFinancials;
  sourceMethod: "upload" | "manual";
}

export interface CompanyReportData {
  companyName: string;
  sector: string;
  city: string;
  financials: ExtractedFinancials;
  ratios: Ratios;
  risk: RiskScore;
  vision2030: Vision2030Score;
  funding: FundingRecommendation;
  benchmark: IndustryBenchmark;
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
}

export interface FinancingRequestRecord {
  input: FinancingRequestInput;
  applicantName: string;
  applicantType: "company" | "startup";
  sector: string;
  bankQuote: PartnerBankQuote;
}

export interface StoredFinancingRequest {
  id: string;
  createdAt: string;
  data: FinancingRequestRecord;
}
