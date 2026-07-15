import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import {
  getBankSession,
  getCompanySession,
  getInquiryCollateralAccess,
} from "@/lib/apiAuth";
import { getFileBlob, getFinancingRequest } from "@/lib/store";

export async function GET(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ requestId: string; documentId: string }> },
) {
  const { requestId, documentId } = await params;
  const request = await getFinancingRequest(requestId);
  if (!request) {
    return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  }

  const bank = getBankSession(req);
  const company = getCompanySession(req);
  const inquiry = getInquiryCollateralAccess(req, requestId);
  const authorizedCompany = Boolean(
    company && request.data.ownerCompanyId === company.companyId,
  );
  const authorizedInquiry = Boolean(
    inquiry && request.data.applicantName === inquiry.applicantName,
  );
  if (!bank && !authorizedCompany && !authorizedInquiry) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const document = request.data.collateral?.assets
    .flatMap((asset) => asset.documents)
    .find((item) => item.id === documentId);
  if (!document || !document.storageKey) {
    return NextResponse.json({ error: "المستند غير موجود" }, { status: 404 });
  }

  let buffer: Buffer;
  if (document.storageKey.includes("/") || document.storageKey.includes("\\")) {
    const root = path.resolve(process.cwd(), "uploads");
    const absolute = path.resolve(process.cwd(), document.storageKey);
    if (!absolute.startsWith(root + path.sep)) {
      return NextResponse.json(
        { error: "مسار مستند غير صالح" },
        { status: 400 },
      );
    }
    buffer = await readFile(absolute);
  } else {
    const blob = await getFileBlob(document.storageKey);
    if (!blob) {
      return NextResponse.json({ error: "المستند غير موجود" }, { status: 404 });
    }
    buffer = Buffer.from(blob.contentBase64, "base64");
  }

  const safeName =
    document.name.replace(/[\r\n"\\/]/g, "-").slice(0, 150) || "document";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": document.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
