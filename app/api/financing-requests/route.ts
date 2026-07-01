import { NextRequest, NextResponse } from "next/server";
import { getReport, saveFinancingRequest } from "@/lib/store";
import { getPartnerBankQuote } from "@/lib/banks";
import {
  CompanyReportData,
  StartupReportData,
  FinancingRequestInput,
  FinancingRequestRecord,
} from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reportId, contactName, phone, email, requestedAmount, purpose, termMonths, notes } =
      body as FinancingRequestInput;

    if (!reportId || !contactName || !phone || !requestedAmount) {
      return NextResponse.json(
        { error: "الحقول المطلوبة غير مكتملة" },
        { status: 400 }
      );
    }

    const report = await getReport(reportId);
    if (!report) {
      return NextResponse.json({ error: "التقرير غير موجود" }, { status: 404 });
    }

    let applicantName: string;
    let sector: string;
    let riskLevel: "low" | "medium" | "high";

    if (report.type === "company") {
      const d = report.data as CompanyReportData;
      applicantName = d.companyName;
      sector = d.sector;
      riskLevel = d.risk.riskLevel;
    } else {
      const d = report.data as StartupReportData;
      applicantName = d.input.projectName;
      sector = d.input.sector;
      riskLevel = d.successProbability >= 65 ? "low" : d.successProbability >= 45 ? "medium" : "high";
    }

    const bankQuote = getPartnerBankQuote(riskLevel, Number(requestedAmount));

    const input: FinancingRequestInput = {
      reportId,
      contactName,
      phone,
      email: email || "",
      requestedAmount: Number(requestedAmount),
      purpose: purpose || "",
      termMonths: Number(termMonths) || 12,
      notes: notes || "",
    };

    const record: FinancingRequestRecord = {
      input,
      applicantName,
      applicantType: report.type,
      sector,
      bankQuote,
    };

    const id = await saveFinancingRequest(record);

    return NextResponse.json({ id, bankQuote });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "تعذر إرسال طلب التمويل. يرجى المحاولة مرة أخرى." },
      { status: 500 }
    );
  }
}
