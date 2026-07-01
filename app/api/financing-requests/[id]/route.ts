import { NextRequest, NextResponse } from "next/server";
import { getFinancingRequest } from "@/lib/store";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const request = await getFinancingRequest(params.id);
  if (!request) {
    return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  }
  return NextResponse.json(request);
}
