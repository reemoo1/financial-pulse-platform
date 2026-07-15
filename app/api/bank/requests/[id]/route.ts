import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getBankSession } from "@/lib/apiAuth";
import { hasBankPermission } from "@/lib/bankAccess";
import {
  collateralContextFromRequest,
  createAssetFromRecommendation,
  createCollateralPackage,
  recalculateCollateralPackage,
} from "@/lib/collateral";
import { csrfErrorResponse, isSameOriginMutation } from "@/lib/requestSecurity";
import { withoutTicketSecurity } from "@/lib/sanitize";
import {
  getFinancingRequest,
  getReport,
  updateBankCreditReview,
  updateCollateralPackage,
} from "@/lib/store";
import {
  CollateralRecommendationOption,
  CommitteeApproval,
  CreditCalculationOverrides,
  CreditCondition,
  CreditConditionStatus,
} from "@/lib/types";

function cleanText(value: unknown, max = 4000) {
  return String(value || "").trim().slice(0, max);
}
function finiteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function conditionStatus(value: unknown): CreditConditionStatus {
  return value === "verified" || value === "waived" || value === "submitted" ? value : "pending";
}
function ok(value: unknown) {
  return NextResponse.json(withoutTicketSecurity(value as any), { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(req)) return csrfErrorResponse();
  const session = getBankSession(req);
  if (!session) return NextResponse.json({ error: "يجب تسجيل الدخول." }, { status: 401 });
  const { id } = await params;
  const current = await getFinancingRequest(id);
  if (!current) return NextResponse.json({ error: "الطلب غير موجود." }, { status: 404 });
  const body = await req.json();
  const action = cleanText(body.action, 80);
  const actor = { userId: session.userId, name: session.name, role: session.role || ("admin" as const) };

  if (action === "save_calculation_override") {
    if (!hasBankPermission(session, "submit_recommendation") && !hasBankPermission(session, "final_decision")) {
      return NextResponse.json({ error: "لا تملكين صلاحية تعديل افتراضات التقييم." }, { status: 403 });
    }
    const raw = body.overrides || {};
    const nullable = (value: unknown) => value === "" || value == null ? null : Math.max(0, finiteNumber(value));
    const overrides: CreditCalculationOverrides = {
      requestedAmountOverride: Math.max(0, finiteNumber(raw.requestedAmountOverride, current.data.input.requestedAmount)),
      termMonthsOverride: Math.max(1, Math.min(240, finiteNumber(raw.termMonthsOverride, current.data.input.termMonths))),
      maximumDebtRatioPercent: Math.max(0, Math.min(100, finiteNumber(raw.maximumDebtRatioPercent, 70))),
      requiredCollateralCoveragePercent: Math.max(0, Math.min(300, finiteNumber(raw.requiredCollateralCoveragePercent, 0))),
      targetDscr: Math.max(0.5, Math.min(3, finiteNumber(raw.targetDscr, 1.3))),
      policyReferenceRate: Math.max(0, Math.min(30, finiteNumber(raw.policyReferenceRate))),
      riskPremium: Math.max(0, Math.min(30, finiteNumber(raw.riskPremium))),
      cashFlowCapacity: nullable(raw.cashFlowCapacity),
      assetBackedCapacity: nullable(raw.assetBackedCapacity),
      leverageCapacity: nullable(raw.leverageCapacity),
      revenueCapacity: nullable(raw.revenueCapacity),
      analystRecommendedAmount: Math.max(0, finiteNumber(raw.analystRecommendedAmount)),
      analystRecommendedRate: Math.max(0, finiteNumber(raw.analystRecommendedRate)),
      note: cleanText(raw.note, 1500),
      updatedAt: new Date().toISOString(),
      updatedBy: session.name,
    };
    const updated = await updateBankCreditReview(id, {
      calculationOverrides: overrides,
      recommendedAmount: overrides.analystRecommendedAmount,
      recommendedRate: overrides.analystRecommendedRate,
      recommendationBy: session.name,
      recommendationAt: overrides.updatedAt,
    }, actor, {
      action: "credit_calculation_overridden",
      details: `تم تعديل افتراضات الحساب؛ المبلغ المقترح ${Math.round(overrides.analystRecommendedAmount || 0).toLocaleString("ar-SA")} ريال والنسبة ${(overrides.analystRecommendedRate || 0).toFixed(2)}%.`,
    });
    return ok(updated);
  }

  if (action === "update_condition") {
    if (!hasBankPermission(session, "final_decision")) {
      return NextResponse.json({ error: "لا تملكين صلاحية تحديث شروط الموافقة." }, { status: 403 });
    }
    const conditionId = cleanText(body.conditionId, 100);
    const checklist = current.data.creditReview?.conditionChecklist || [];
    if (!checklist.some((item) => item.id === conditionId)) {
      return NextResponse.json({ error: "الشرط غير موجود." }, { status: 404 });
    }
    const nextStatus = conditionStatus(body.status);
    const updatedChecklist = checklist.map((item) => item.id === conditionId ? {
      ...item,
      status: nextStatus,
      note: cleanText(body.note, 500) || item.note,
      updatedAt: new Date().toISOString(),
      updatedBy: session.name,
    } : item);
    const updated = await updateBankCreditReview(id, { conditionChecklist: updatedChecklist }, actor, {
      action: "conditional_approval_condition_updated",
      details: `تم تحديث حالة شرط الموافقة إلى ${nextStatus}.`,
    });
    return ok(updated);
  }

  if (action === "final_approval") {
    if (!hasBankPermission(session, "final_decision")) {
      return NextResponse.json({ error: "لا تملكين صلاحية إصدار الموافقة النهائية." }, { status: 403 });
    }
    const review = current.data.creditReview;
    if (review?.finalDecision !== "conditional") {
      return NextResponse.json({ error: "الموافقة النهائية هنا متاحة فقط بعد موافقة مبدئية مشروطة." }, { status: 409 });
    }
    const pendingConditions = (review.conditionChecklist || []).filter((item) => item.required && !["verified", "waived"].includes(item.status));
    if (pendingConditions.length) {
      return NextResponse.json({ error: "لا يمكن إصدار الموافقة النهائية قبل استيفاء جميع الشروط.", blockers: pendingConditions.map((item) => item.title) }, { status: 409 });
    }
    const collateral = current.data.collateral;
    if (!collateral || !collateral.allMandatoryApproved || collateral.shortfall > 0) {
      return NextResponse.json({
        error: "لا يمكن إصدار الموافقة النهائية قبل رفع واعتماد حزمة الضمان المطلوبة.",
        blockers: collateral?.missingRequirements || ["حزمة الضمان غير منشأة أو غير معتمدة"],
      }, { status: 409 });
    }
    const now = new Date().toISOString();
    const authorizedOfficer: CommitteeApproval = {
      role: "authorized_officer",
      decision: "approve",
      actorId: actor.userId,
      actorName: actor.name,
      actorRole: actor.role,
      note: cleanText(body.note) || "تم استيفاء الشروط واعتماد الضمانات المطلوبة.",
      createdAt: now,
    };
    const updated = await updateBankCreditReview(id, {
      finalDecision: "approved",
      finalDecisionBy: session.name,
      finalDecisionAt: now,
      committee: { ...(review.committee || {}), authorizedOfficer, completedAt: now },
      rationale: [review.rationale, cleanText(body.note)].filter(Boolean).join("\n"),
    }, actor, {
      status: "approved",
      action: "financing_final_approval",
      details: "تم إصدار الموافقة النهائية بعد استيفاء الشروط واعتماد حزمة الضمان. تبدأ الآن مرحلة التوثيق والتفعيل قبل الصرف.",
    });
    return ok(updated);
  }

  if (action !== "final_decision") return NextResponse.json({ error: "إجراء غير معروف." }, { status: 400 });
  if (!hasBankPermission(session, "final_decision")) {
    return NextResponse.json({ error: "لا تملكين صلاحية اعتماد قرار التمويل." }, { status: 403 });
  }

  const decision = body.decision === "rejected" ? "rejected" : body.decision === "approved" ? "approved" : "conditional";
  const conditions = Array.isArray(body.conditions)
    ? body.conditions.map((item: unknown) => cleanText(item, 500)).filter(Boolean).slice(0, 20)
    : [];
  const rationale = cleanText(body.rationale);
  const now = new Date().toISOString();
  const authorizedOfficer: CommitteeApproval = {
    role: "authorized_officer",
    decision: decision === "approved" ? "approve" : decision === "conditional" ? "conditional" : "reject",
    actorId: actor.userId,
    actorName: actor.name,
    actorRole: actor.role,
    note: rationale,
    createdAt: now,
  };

  if (decision === "rejected") {
    const updated = await updateBankCreditReview(id, {
      finalDecision: "rejected",
      finalDecisionBy: session.name,
      finalDecisionAt: now,
      rationale,
      conditions,
      conditionChecklist: [],
      committee: { authorizedOfficer, completedAt: now },
    }, actor, { status: "rejected", action: "financing_rejected", details: rationale || "تم رفض طلب التمويل بعد المراجعة الائتمانية." });
    return ok(updated);
  }

  const approvedAmount = finiteNumber(body.approvedAmount);
  const approvedRate = finiteNumber(body.approvedRate);
  const approvedTermMonths = Math.round(finiteNumber(body.approvedTermMonths));
  if (approvedAmount <= 0 || approvedRate < 0 || approvedTermMonths < 1 || approvedTermMonths > 120) {
    return NextResponse.json({ error: "بيانات مبلغ أو نسبة أو مدة التمويل غير صالحة." }, { status: 400 });
  }

  const report = await getReport(current.data.input.reportId);
  const context = {
    ...collateralContextFromRequest(current.data, report?.data || null),
    approvedFinancingAmount: approvedAmount,
  };
  const previewPackage = createCollateralPackage(context);
  if (decision === "approved" && previewPackage.requiredCoverageRatio > 0) {
    return NextResponse.json({
      error: "تقييم المخاطر يتطلب ضماناً مؤهلاً. أصدري موافقة مبدئية مشروطة أولاً ليتم رفع الضمان قبل القبول النهائي.",
    }, { status: 409 });
  }
  if (decision === "conditional" && conditions.length === 0) {
    return NextResponse.json({ error: "الموافقة المشروطة تتطلب شرطاً واحداً على الأقل." }, { status: 400 });
  }

  const conditionChecklist: CreditCondition[] = conditions.map((title) => ({
    id: randomUUID(),
    title,
    category: inferConditionCategory(title),
    required: true,
    status: "pending",
  }));
  const status = decision === "conditional" ? "conditional_approval" : "approved";
  const reviewed = await updateBankCreditReview(id, {
    finalDecision: decision,
    approvedAmount,
    approvedRate,
    approvedTermMonths,
    finalDecisionBy: decision === "approved" ? session.name : undefined,
    finalDecisionAt: decision === "approved" ? now : undefined,
    preliminaryDecisionBy: decision === "conditional" ? session.name : undefined,
    preliminaryDecisionAt: decision === "conditional" ? now : undefined,
    rationale,
    conditions,
    conditionChecklist,
    committee: decision === "approved" ? { authorizedOfficer, completedAt: now } : { authorizedOfficer },
  }, actor, {
    status,
    action: decision === "conditional" ? "financing_preliminary_conditional_approval" : "financing_approved",
    details: `${decision === "conditional" ? "موافقة مبدئية مشروطة" : "موافقة نهائية مباشرة دون ضمان عيني"} بمبلغ ${Math.round(approvedAmount).toLocaleString("ar-SA")} ريال لمدة ${approvedTermMonths} شهر.`,
  });
  if (!reviewed) return NextResponse.json({ error: "تعذر حفظ القرار." }, { status: 500 });

  let collateral = reviewed.data.collateral;
  if (!collateral) {
    const draft = createCollateralPackage({ ...context, approvedFinancingAmount: approvedAmount });
    const promissory = draft.recommendations.find((item) => item.type === "promissory_note");
    const candidates = draft.recommendations
      .filter((item) => item.type !== "promissory_note" && item.estimatedEligibleValue > 0)
      .sort((a, b) => b.suitabilityScore - a.suitabilityScore);
    const selected: CollateralRecommendationOption[] = [];
    let estimatedCoverage = 0;
    if (draft.requiredEligibleValue > 0) {
      for (const option of candidates) {
        selected.push({ ...option, mandatory: true });
        estimatedCoverage += Math.min(option.estimatedEligibleValue, draft.requiredEligibleValue * option.maximumCoverageShare);
        if (estimatedCoverage >= draft.requiredEligibleValue || selected.length >= 3) break;
      }
    }
    const chosen = [...(promissory ? [{ ...promissory, mandatory: true }] : []), ...selected];
    collateral = recalculateCollateralPackage({
      ...draft,
      status: "awaiting_submission",
      assets: chosen.map((option) => createAssetFromRecommendation(option, reviewed.data.applicantName)),
    });
  } else {
    collateral = recalculateCollateralPackage({
      ...collateral,
      approvedFinancingAmount: approvedAmount,
      requiredCoverageRatio: previewPackage.requiredCoverageRatio,
      status: ["active", "enforcement", "released"].includes(collateral.status) ? collateral.status : "awaiting_submission",
    });
  }
  const withCollateral = await updateCollateralPackage(id, collateral, actor, {
    action: "collateral_requirements_created",
    details: previewPackage.requiredCoverageRatio > 0
      ? "تم إنشاء حزمة الضمان المطلوبة وإتاحتها للشركة بعد الموافقة المبدئية."
      : "لا يلزم ضمان عيني وفق السياسة الحالية؛ تم إنشاء متطلب التوثيق الخفيف قبل الصرف.",
  });
  return ok(withCollateral || reviewed);
}

function inferConditionCategory(title: string): CreditCondition["category"] {
  if (/ضمان|رهن|كفالة|سند/.test(title)) return "collateral";
  if (/قائمة|كشف|مستند|سجل|هوية/.test(title)) return "document";
  if (/DSCR|مديون|تدفق|مالي|نسبة/.test(title)) return "financial";
  if (/عقد|قانون|توثيق/.test(title)) return "legal";
  return "other";
}
