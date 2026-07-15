import { NextRequest, NextResponse } from "next/server";
import { getBankSession } from "@/lib/apiAuth";
import { hasBankPermission } from "@/lib/bankAccess";
import {
  COLLATERAL_CATALOG,
  createAssetFromRecommendation,
  recalculateCollateralPackage,
} from "@/lib/collateral";
import { csrfErrorResponse, isSameOriginMutation } from "@/lib/requestSecurity";
import { withoutTicketSecurity } from "@/lib/sanitize";
import { getFinancingRequest, updateCollateralPackage } from "@/lib/store";
import { BankPermission, CollateralAsset, CollateralPackage } from "@/lib/types";

function text(value: unknown, max = 1200) {
  return String(value || "").trim().slice(0, max);
}
function num(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : fallback;
}

const ACTION_PERMISSION: Record<string, BankPermission> = {
  send_to_company: "manage_collateral",
  add_recommendation: "manage_collateral",
  update_valuation: "manage_collateral",
  request_correction: "manage_collateral",
  approve_asset: "approve_collateral",
  reject_asset: "approve_collateral",
  approve_package: "approve_collateral",
  perfect_asset: "perfect_collateral",
  activate_package: "perfect_collateral",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginMutation(req)) return csrfErrorResponse();
  const session = getBankSession(req);
  if (!session) return NextResponse.json({ error: "يجب تسجيل الدخول." }, { status: 401 });
  const { id } = await params;
  const request = await getFinancingRequest(id);
  if (!request?.data.collateral) {
    return NextResponse.json({ error: "لا توجد حزمة ضمان مرتبطة بهذا الطلب." }, { status: 404 });
  }

  const body = await req.json();
  const action = text(body.action, 60);
  const permission = ACTION_PERMISSION[action];
  if (!permission || !hasBankPermission(session, permission)) {
    return NextResponse.json({ error: "لا تملكين صلاحية تنفيذ هذا الإجراء." }, { status: 403 });
  }

  const actor = {
    userId: session.userId,
    name: session.name,
    role: session.role || ("admin" as const),
  };
  let collateral: CollateralPackage = request.data.collateral;
  let details = "تم تحديث حزمة الضمانات.";

  const assetId = text(body.assetId, 100);
  const asset = assetId ? collateral.assets.find((item) => item.id === assetId) : undefined;
  const replaceAsset = (next: CollateralAsset) => {
    collateral = { ...collateral, assets: collateral.assets.map((item) => item.id === next.id ? next : item) };
  };

  if (action === "send_to_company") {
    collateral = {
      ...collateral,
      status: "awaiting_submission",
      submittedAt: undefined,
      submittedBy: undefined,
      assets: collateral.assets.map((item) =>
        ["rejected", "recommended"].includes(item.status)
          ? { ...item, status: "requested" as const }
          : item,
      ),
    };
    details = "تم إرسال متطلبات الضمان للشركة داخل طلب التمويل المعتمد.";
  } else if (action === "add_recommendation") {
    const type = text(body.type, 80);
    const option = collateral.recommendations.find((item) => item.type === type);
    if (!option) return NextResponse.json({ error: "التوصية غير موجودة." }, { status: 404 });
    if (collateral.assets.some((item) => item.type === option.type)) {
      return NextResponse.json({ error: "هذا النوع مضاف بالفعل للطلب." }, { status: 409 });
    }
    collateral = {
      ...collateral,
      status: "awaiting_submission",
      assets: [
        ...collateral.assets,
        createAssetFromRecommendation(
          { ...option, mandatory: Boolean(body.mandatory) },
          request.data.applicantName,
        ),
      ],
    };
    details = `تمت إضافة ${option.label} إلى متطلبات هذا الطلب.`;
  } else if (action === "update_valuation") {
    if (!asset) return NextResponse.json({ error: "الضمان غير موجود." }, { status: 404 });
    replaceAsset({
      ...asset,
      description: text(body.description) || asset.description,
      haircut: body.haircut === "" || body.haircut == null ? asset.haircut : Math.min(1, num(body.haircut, asset.haircut)),
      maximumCoverageShare: body.maximumCoverageShare === "" || body.maximumCoverageShare == null ? asset.maximumCoverageShare : Math.min(1, num(body.maximumCoverageShare, asset.maximumCoverageShare)),
      valuation: {
        ...asset.valuation,
        marketValue: num(body.marketValue, asset.valuation.marketValue),
        forcedSaleValue:
          body.forcedSaleValue === "" || body.forcedSaleValue == null
            ? asset.valuation.forcedSaleValue
            : num(body.forcedSaleValue, asset.valuation.forcedSaleValue || 0),
        realisationCosts: num(body.realisationCosts, asset.valuation.realisationCosts || 0),
        source: "independent_valuation",
        valuationDate: text(body.valuationDate, 20) || asset.valuation.valuationDate,
        valuer: text(body.valuer, 180) || asset.valuation.valuer,
      },
    });
    details = `تم تحديث تقييم الضمان ${asset.label}.`;
  } else if (action === "request_correction") {
    if (!asset) return NextResponse.json({ error: "الضمان غير موجود." }, { status: 404 });
    replaceAsset({
      ...asset,
      status: "requested",
      notes: [asset.notes, text(body.note) || "طلب البنك استكمال أو تصحيح البيانات."].filter(Boolean).join(" "),
    });
    collateral = { ...collateral, status: "awaiting_submission", approvedAt: undefined, approvedBy: undefined };
    details = `تم طلب استكمال الضمان ${asset.label} من الشركة.`;
  } else if (action === "approve_asset") {
    if (!asset) return NextResponse.json({ error: "الضمان غير موجود." }, { status: 404 });
    if (asset.documents.length === 0) {
      return NextResponse.json({ error: "لا يمكن اعتماد الضمان قبل رفع مستنداته." }, { status: 409 });
    }
    const cfg = COLLATERAL_CATALOG[asset.type];
    const nonLegalChecks = cfg.defaultChecks.filter((check) => check !== "legalPerfectionVerified");
    replaceAsset({
      ...asset,
      status: "approved",
      documents: asset.documents.map((doc) => ({ ...doc, status: "verified", verifiedAt: new Date().toISOString(), verifiedBy: session.name })),
      checks: {
        ...asset.checks,
        ...Object.fromEntries(nonLegalChecks.map((check) => [check, true])),
      },
    });
    details = `تم التحقق من مستندات وقيمة الضمان ${asset.label} واعتماده ائتمانيًا.`;
  } else if (action === "reject_asset") {
    if (!asset) return NextResponse.json({ error: "الضمان غير موجود." }, { status: 404 });
    replaceAsset({
      ...asset,
      status: "rejected",
      documents: asset.documents.map((doc) => ({ ...doc, status: "rejected", note: text(body.note) || "لم يجتز التحقق." })),
      notes: [asset.notes, text(body.note) || "تم رفض الضمان بعد المراجعة."].filter(Boolean).join(" "),
    });
    details = `تم رفض الضمان ${asset.label}.`;
  } else if (action === "approve_package") {
    const mandatory = collateral.assets.filter((item) => item.mandatory);
    const pendingMandatory = mandatory.filter((item) => !["approved", "perfected", "active"].includes(item.status));
    if (pendingMandatory.length) {
      return NextResponse.json(
        { error: "يجب اعتماد جميع الضمانات الإلزامية أولًا.", blockers: pendingMandatory.map((item) => item.label) },
        { status: 409 },
      );
    }
    collateral = {
      ...collateral,
      approvedAt: new Date().toISOString(),
      approvedBy: session.name,
      status: "approved",
    };
    details = "تم اعتماد حزمة الضمان ائتمانيًا وبدء مرحلة التوثيق والنفاذ القانوني.";
  } else if (action === "perfect_asset") {
    if (!asset) return NextResponse.json({ error: "الضمان غير موجود." }, { status: 404 });
    if (!["approved", "perfection_pending", "perfected"].includes(asset.status)) {
      return NextResponse.json({ error: "يجب اعتماد الضمان ائتمانيًا قبل التوثيق." }, { status: 409 });
    }
    replaceAsset({
      ...asset,
      status: "perfected",
      documents: asset.documents.map((doc) => ({ ...doc, status: "verified", verifiedAt: doc.verifiedAt || new Date().toISOString(), verifiedBy: doc.verifiedBy || session.name })),
      checks: {
        ownershipVerified: true,
        encumbranceChecked: true,
        valuationVerified: true,
        insuranceVerified: true,
        legalPerfectionVerified: true,
      },
    });
    details = `اكتمل توثيق ونفاذ الضمان ${asset.label}.`;
  } else if (action === "activate_package") {
    const checked = recalculateCollateralPackage(collateral);
    if (!checked.readyForActivation) {
      return NextResponse.json(
        { error: "لا يمكن تفعيل الحزمة قبل اكتمال جميع متطلبات التغطية والتوثيق.", blockers: checked.missingRequirements },
        { status: 409 },
      );
    }
    collateral = {
      ...checked,
      activatedAt: new Date().toISOString(),
      activatedBy: session.name,
      status: "active",
      assets: checked.assets.map((item) => item.status === "perfected" ? { ...item, status: "active" as const } : item),
    };
    details = "تم تفعيل حزمة الضمان وأصبح الطلب مؤهلًا لمرحلة الصرف.";
  } else {
    return NextResponse.json({ error: "إجراء غير معروف." }, { status: 400 });
  }

  collateral = recalculateCollateralPackage(collateral);
  const updated = await updateCollateralPackage(id, collateral, actor, {
    action: `collateral_${action}`,
    details,
  });
  if (!updated) return NextResponse.json({ error: "تعذر حفظ التحديث." }, { status: 500 });
  return NextResponse.json(withoutTicketSecurity(updated), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
