import { NextRequest, NextResponse } from "next/server";
import {
  extractFromWorkbookBuffer,
  computeRatios,
  computeRiskScore,
  computeVision2030Score,
  computeFundingRecommendation,
  getIndustryBenchmark,
} from "@/lib/financial";
import { generateCompanyNarrative } from "@/lib/ai";
import { saveReport } from "@/lib/store";
import { CompanyReportData, ExtractedFinancials } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const companyName = String(formData.get("companyName") || "شركة غير مسماة");
    const sector = String(formData.get("sector") || "أخرى");
    const city = String(formData.get("city") || "");
    const sourceMethod = String(formData.get("sourceMethod") || "manual") as
      | "upload"
      | "manual";

    let financials: ExtractedFinancials;

    const file = formData.get("file");
    if (sourceMethod === "upload" && file instanceof File) {
      const buffer = await file.arrayBuffer();
      const { financials: extracted } = extractFromWorkbookBuffer(buffer);
      financials = extracted;
    } else {
      financials = {
        currentAssets: Number(formData.get("currentAssets") || 0),
        currentLiabilities: Number(formData.get("currentLiabilities") || 0),
        totalAssets: Number(formData.get("totalAssets") || 0),
        totalLiabilities: Number(formData.get("totalLiabilities") || 0),
        netIncome: Number(formData.get("netIncome") || 0),
        revenue: Number(formData.get("revenue") || 0),
        operatingCashFlow: Number(formData.get("operatingCashFlow") || 0),
      };
    }

    const ratios = computeRatios(financials);
    const risk = computeRiskScore(financials, ratios);
    const vision2030 = computeVision2030Score(sector);
    const funding = computeFundingRecommendation(financials, ratios, risk);
    const benchmark = getIndustryBenchmark(sector);

    const reportBase: Omit<CompanyReportData, "narrative"> = {
      companyName,
      sector,
      city,
      financials,
      ratios,
      risk,
      vision2030,
      funding,
      benchmark,
    };

    const narrative = await generateCompanyNarrative(reportBase);

    const reportData: CompanyReportData = { ...reportBase, narrative };
    const id = await saveReport("company", reportData);

    return NextResponse.json({ id });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "تعذر تحليل البيانات. يرجى المحاولة مرة أخرى." },
      { status: 500 }
    );
  }
}
