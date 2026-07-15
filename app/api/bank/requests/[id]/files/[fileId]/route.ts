import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getBankSession } from "@/lib/apiAuth";
import { getFileBlob, getFinancingRequest } from "@/lib/store";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const session = getBankSession(req);
  if (!session) return NextResponse.json({ error: "يجب تسجيل الدخول." }, { status: 401 });
  const { id, fileId } = await params;
  const request = await getFinancingRequest(id);
  if (!request) return NextResponse.json({ error: "الطلب غير موجود." }, { status: 404 });
  const file = request.data.uploadedFiles?.find((item) => item.id === fileId);
  if (!file) return NextResponse.json({ error: "المستند غير موجود." }, { status: 404 });

  let buffer: Buffer;
  if (file.storage === "database" && file.storageKey) {
    const blob = await getFileBlob(file.storageKey);
    if (!blob) return NextResponse.json({ error: "تعذر قراءة المستند." }, { status: 404 });
    buffer = Buffer.from(blob.contentBase64, "base64");
  } else {
    const relative = file.storageKey || file.path;
    const uploadsRoot = path.resolve(process.cwd(), "uploads");
    const absolute = path.resolve(process.cwd(), relative);
    if (!absolute.startsWith(`${uploadsRoot}${path.sep}`)) return NextResponse.json({ error: "مسار غير صالح." }, { status: 400 });
    buffer = await readFile(absolute);
  }

  const safeName = (file.originalName || "document").replace(/[\r\n"\\/]/g, "-").slice(0, 150);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
