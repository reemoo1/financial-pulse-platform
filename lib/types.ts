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
