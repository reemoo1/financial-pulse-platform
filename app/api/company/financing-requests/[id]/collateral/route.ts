import { NextRequest, NextResponse } from "next/server";
import {
  getCompanySession,
  getInquiryCollateralAccess,
} from "@/lib/apiAuth";
import { recalculateCollateralPackage } from "@/lib/collateral";
import { csrfErrorResponse, isSameOriginMutation } from "@/lib/requestSecurity";
import {
  getFinancingRequest,
  updateCollateralPackageByCompany,
} from "@/lib/store";
import { CollateralAsset } from "@/lib/types";
import { withoutTicketSecurity } from "@/lib/sanitize";

const LOCKED_PACKAGE_STATUSES = new Set([
  "under_review",
  "approved",
  "perfection_pending",
  "active",
  "enforcement",
  "released",
]);

function clean(value: unknown, max = 1000) {
  return String(value || "")
    .trim()
    .slice(0, max);
}

function num(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

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
            : "حزمة الضمانات مقفلة حاليًا ولا تقبل تعديلات من الشركة.",
      },
      { status: 409 },
    );
  }

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

  const body = await req.json();
  const action = clean(body.action, 50);
  let collateral = request.data.collateral;
  let details = "حدثت الشركة بيانات الضمانات.";

  if (action === "update_asset") {
    const assetId = clean(body.assetId, 80);
    const asset = collateral.assets.find((item) => item.id === assetId);
    if (!asset) {
      return NextResponse.json({ error: "الضمان غير موجود." }, { status: 404 });
    }
    if (["approved", "perfected", "active", "rejected"].includes(asset.status)) {
      return NextResponse.json(
        { error: "لا يمكن تعديل هذا الضمان في حالته الحالية." },
        { status: 409 },
      );
    }

    const marketValue =
      body.marketValue === undefined
        ? asset.valuation.marketValue
        : num(body.marketValue);
    const forcedSaleValue =
      body.forcedSaleValue === undefined
        ? asset.valuation.forcedSaleValue
        : body.forcedSaleValue === null
          ? null
          : num(body.forcedSaleValue);

    collateral = recalculateCollateralPackage({
      ...collateral,
      assets: collateral.assets.map((item) =>
        item.id !== assetId
          ? item
          : {
              ...item,
              description: clean(body.description, 1200) || item.description,
              ownerName: clean(body.ownerName, 180) || item.ownerName,
              ownerType: ["company", "shareholder", "third_party"].includes(
                body.ownerType,
              )
                ? (body.ownerType as CollateralAsset["ownerType"])
                : item.ownerType,
              identifier:
                body.identifier === undefined
                  ? item.identifier
                  : clean(body.identifier, 160) || undefined,
              valuation: {
                ...item.valuation,
                marketValue,
                forcedSaleValue,
                valuationDate:
                  body.valuationDate === undefined
                    ? item.valuation.valuationDate
                    : clean(body.valuationDate, 20) || undefined,
                valuer:
                  body.valuer === undefined
                    ? item.valuation.valuer
                    : clean(body.valuer, 160) || undefined,
                source: clean(body.valuer, 160)
                  ? ("independent_valuation" as const)
                  : ("client_declared" as const),
                realisationCosts:
                  body.realisationCosts === undefined
                    ? item.valuation.realisationCosts
                    : num(body.realisationCosts),
                timeToRealiseMonths:
                  body.timeToRealiseMonths === undefined
                    ? item.valuation.timeToRealiseMonths
                    : num(body.timeToRealiseMonths, 0, 120),
                discountRate:
                  body.discountRate === undefined
                    ? item.valuation.discountRate
                    : num(body.discountRate, 0, 1),
              },
              notes:
                body.notes === undefined ? item.notes : clean(body.notes, 1200),
              status:
                item.status === "requested"
                  ? ("submitted" as const)
                  : item.status,
            },
      ),
    });
    details = `حدّثت الشركة بيانات الضمان ${asset.label}.`;
  } else if (action === "submit_package") {
    const missing = collateral.assets.filter(
      (asset) => asset.mandatory && asset.documents.length === 0,
    );
    if (missing.length) {
      return NextResponse.json(
        {
          error: "يجب رفع مستند واحد على الأقل لكل ضمان إلزامي.",
          blockers: missing.map((asset) => asset.label),
        },
        { status: 409 },
      );
    }

    collateral = recalculateCollateralPackage({
      ...collateral,
      status: "under_review",
      submittedAt: new Date().toISOString(),
      submittedBy: actor.name,
      assets: collateral.assets.map((asset) =>
        asset.status === "requested"
          ? { ...asset, status: "submitted" as const }
          : asset,
      ),
    });
    details = "أرسلت الشركة حزمة الضمانات للبنك للمراجعة.";
  } else {
    return NextResponse.json({ error: "إجراء غير معروف." }, { status: 400 });
  }

  const updated = await updateCollateralPackageByCompany(
    id,
    collateral,
    actor,
    details,
  );
  if (!updated) {
    return NextResponse.json({ error: "تعذر حفظ تحديث الضمانات." }, { status: 409 });
  }
  return NextResponse.json(withoutTicketSecurity(updated), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
