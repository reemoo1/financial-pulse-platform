import { NextRequest, NextResponse } from "next/server";
import { analyzeStartup } from "@/lib/startup";
import { saveReport } from "@/lib/store";
import { StartupAnalysisInput } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StartupAnalysisInput;

    if (!body.projectName || !body.sector) {
      return NextResponse.json(
        { error: "اسم المشروع والقطاع حقول مطلوبة" },
        { status: 400 }
      );
    }

    const input: StartupAnalysisInput = {
      projectName: body.projectName,
      ideaDescription: body.ideaDescription || "",
      sector: body.sector,
      city: body.city || "",
      currentCapital: Number(body.currentCapital) || 0,
      expectedBudget: Number(body.expectedBudget) || 0,
      employeeCount: Number(body.employeeCount) || 0,
      goals: body.goals || "",
      revenueSources: body.revenueSources || "",
      expenses: body.expenses || "",
      targetAudience: body.targetAudience || "",
    };

    const reportData = analyzeStartup(input);
    const id = await saveReport("startup", reportData);

    return NextResponse.json({ id });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "تعذر تحليل المشروع. يرجى المحاولة مرة أخرى." },
      { status: 500 }
    );
  }
}
