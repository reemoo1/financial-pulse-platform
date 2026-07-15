import { NextRequest, NextResponse } from "next/server";
import { extractFinancingFieldsFromPdf } from "@/lib/pdfExtract";
import { validateFile } from "@/lib/fileUpload";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || !file.name) {
      return NextResponse.json({ error: "يرجى رفع ملف PDF صالح" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    validateFile(file, buffer.length, "company_pdf");

    // Magic-bytes check: a real PDF starts with %PDF. Rejects renamed files.
    if (buffer.length < 5 || buffer.subarray(0, 4).toString("latin1") !== "%PDF") {
      return NextResponse.json(
        { error: "الملف المرفوع ليس ملف PDF صالحاً" },
        { status: 400 }
      );
    }

    const extracted = await extractFinancingFieldsFromPdf(buffer);
    return NextResponse.json({ extracted });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message || "تعذر استخراج البيانات من ملف PDF" },
      { status: 500 }
    );
  }
}
