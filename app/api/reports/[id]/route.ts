import { NextRequest, NextResponse } from "next/server";
import { getReport } from "@/lib/store";
import { normalizeCompanyReportData } from "@/lib/financial";
import {
  CompanyReportData,
  StartupReportData,
  StoredReport,
} from "@/lib/types";
import { canReadReport } from "@/lib/apiAuth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) {
    return NextResponse.json(
      { error: "التقرير غير موجود" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const ownerCompanyId = report.data._accessControl?.ownerCompanyId;
  if (!canReadReport(req, id, ownerCompanyId)) {
    return NextResponse.json(
      { error: "يجب تسجيل الدخول بالحساب المالك أو فتح التقرير من جلسة إنشائه" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const normalized: StoredReport =
    report.type === "company"
      ? {
          ...report,
          data: normalizeCompanyReportData(report.data as CompanyReportData),
        }
      : report;

  return NextResponse.json(stripAccessControl(normalized), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

function stripAccessControl(report: StoredReport): StoredReport {
  const { _accessControl: _internal, ...data } = report.data as
    | CompanyReportData
    | StartupReportData;
  return { ...report, data } as StoredReport;
}
