import { NextRequest, NextResponse } from "next/server";
import { analyzeStartup } from "@/lib/startup";
import { saveReport, generateUniqueReferenceNumber } from "@/lib/store";

import { StartupAnalysisInput } from "@/lib/types";
import {
  createReportAccessToken,
  REPORT_ACCESS_COOKIE,
  REPORT_ACCESS_MAX_AGE,
} from "@/lib/auth";
import { getCompanySession } from "@/lib/apiAuth";

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

    const companySession = getCompanySession(req);
    const reportData = {
      ...analyzeStartup(input),
      _accessControl: companySession
        ? { ownerCompanyId: companySession.companyId }
        : undefined,
      referenceNumber: await generateUniqueReferenceNumber(),
    };
    const id = await saveReport("startup", reportData);

    const response = NextResponse.json(
      { id },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(REPORT_ACCESS_COOKIE, createReportAccessToken(id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: REPORT_ACCESS_MAX_AGE,
    });
    return response;
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "تعذر معالجة بيانات المشروع. يرجى المحاولة مرة أخرى." },
      { status: 500 }
    );
  }
}
