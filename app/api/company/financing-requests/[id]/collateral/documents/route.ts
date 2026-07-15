import { NextRequest, NextResponse } from "next/server";
import {
  getCompanySession,
  getInquiryCollateralAccess,
} from "@/lib/apiAuth";
import { recalculateCollateralPackage } from "@/lib/collateral";
import { saveUploadedFile } from "@/lib/fileUpload";
import { csrfErrorResponse, isSameOriginMutation } from "@/lib/requestSecurity";
import {
  getFinancingRequest,
  updateCollateralPackageByCompany,
} from "@/lib/store";
import { CollateralDocument } from "@/lib/types";
import { withoutTicketSecurity } from "@/lib/sanitize";
import { v4 as uuidv4 } from "uuid";

const DOCUMENT_TYPES = new Set([
  "ownership",
  "valuation",
  "insurance",
  "registration",
  "assignment",
  "guarantee_letter",
  "promissory_note",
  "financial_statement",
  "other",
]);

const LOCKED_PACKAGE_STATUSES = new Set([
  "under_review",
  "approved",
  "perfection_pending",
  "active",
  "enforcement",
  "released",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginMutation(req)) return csrfErrorResponse();

  const { id } = await params;
  const companySession = getCompanySession(req);
  const inquiryAccess = getInquiryCollateralAccess(req, id);
  if (!companySession && !inquiryAccess) {
    return NextResponse.json(
      { error: "انتهت جلسة التحقق. أعيدي الاستعلام وأدخلي رمز OTP مرة أخرى." },
      { status: 401 },
    );
  }

  try {
    const request = await getFinancingRequest(id);
    if (!request) {
      return NextResponse.json({ error: "الطلب غير موجود." }, { status: 404 });
    }
    if (
      companySession &&
      request.data.ownerCompanyId !== companySession.companyId
    ) {
      return NextResponse.json(
        { error: "الطلب غير موجود أو لا يخص هذه الشركة." },
        { status: 404 },
      );
    }
    if (
      inquiryAccess &&
      request.data.applicantName !== inquiryAccess.applicantName
    ) {
      return NextResponse.json({ error: "غير مصرح لهذا الطلب." }, { status: 403 });
    }
    if (!request.data.collateral) {
      return NextResponse.json(
        { error: "لم يرسل البنك متطلبات الضمانات بعد." },
        { status: 409 },
      );
    }
    if (LOCKED_PACKAGE_STATUSES.has(request.data.collateral.status)) {
      return NextResponse.json(
        {
          error:
            request.data.collateral.status === "under_review"
              ? "تم إرسال الحزمة للبنك وهي مقفلة مؤقتًا حتى انتهاء المراجعة أو طلب استكمال جديد."
              : "حزمة الضمانات مقفلة حاليًا.",
        },
        { status: 409 },
      );
    }

    const form = await req.formData();
    const assetId = String(form.get("assetId") || "").trim();
    const typeRaw = String(form.get("documentType") || "other");
    const documentType = DOCUMENT_TYPES.has(typeRaw)
      ? (typeRaw as CollateralDocument["type"])
      : "other";
    const reference =
      String(form.get("reference") || "")
        .trim()
        .slice(0, 200) || undefined;
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "اختاري مستندًا صالحًا." },
        { status: 400 },
      );
    }

    const asset = request.data.collateral.assets.find(
      (item) => item.id === assetId,
    );
    if (!asset) {
      return NextResponse.json({ error: "الضمان غير موجود." }, { status: 404 });
    }
    if (asset.documents.length >= 20) {
      return NextResponse.json(
        { error: "تم بلوغ الحد الأقصى لمستندات هذا الضمان." },
        { status: 409 },
      );
    }

    const stored = await saveUploadedFile(id, file, "attachment");
    const actorName = companySession
      ? companySession.companyName
      : inquiryAccess!.applicantName;
    const document: CollateralDocument = {
      id: uuidv4(),
      type: documentType,
      name: stored.metadata.originalName,
      reference,
      storageKey: stored.metadata.storageKey,
      mimeType: stored.metadata.mimeType,
      size: stored.metadata.size,
      uploadedAt: stored.metadata.uploadedAt,
      uploadedBy: actorName,
      uploadedByType: "company",
      status: "pending",
    };

    const collateral = recalculateCollateralPackage({
      ...request.data.collateral,
      assets: request.data.collateral.assets.map((item) =>
        item.id === assetId
          ? {
              ...item,
              documents: [...item.documents, document],
              status:
                item.status === "requested"
                  ? ("submitted" as const)
                  : item.status,
            }
          : item,
      ),
    });

    const actor = companySession
      ? {
          companyId: companySession.companyId,
          name: companySession.companyName,
          accessMethod: "company_session" as const,
        }
      : {
          name: inquiryAccess!.applicantName,
          accessMethod: "otp_inquiry" as const,
        };
    const updated = await updateCollateralPackageByCompany(
      id,
      collateral,
      actor,
      `رفعت الشركة مستند ${document.name} للضمان ${asset.label}.`,
    );
    if (!updated) {
      return NextResponse.json(
        { error: "تعذر حفظ المستند في ملف الضمانات." },
        { status: 409 },
      );
    }
    return NextResponse.json(withoutTicketSecurity(updated), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Company collateral upload failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "تعذر رفع المستند.",
      },
      { status: 400 },
    );
  }
}
