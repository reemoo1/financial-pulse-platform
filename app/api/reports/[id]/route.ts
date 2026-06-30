import { NextRequest, NextResponse } from "next/server";
import { getReport } from "@/lib/store";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const report = await getReport(params.id);
  if (!report) {
    return NextResponse.json({ error: "التقرير غير موجود" }, { status: 404 });
  }
  return NextResponse.json(report);
}
