import { NextRequest, NextResponse } from "next/server";
import { getBankSession } from "@/lib/apiAuth";
import { hasBankPermission } from "@/lib/bankAccess";
import { saveUploadedFile } from "@/lib/fileUpload";
import { buildMonitoringSnapshot } from "@/lib/monitoring";
import { csrfErrorResponse, isSameOriginMutation } from "@/lib/requestSecurity";
import { withoutTicketSecurity } from "@/lib/sanitize";
import {
  addMonitoringAction,
  addMonitoringSnapshotWithAudit,
  getFinancingRequest,
  recordCollectionEvent,
  recordFinancingDisbursement,
  recordInstallmentPayment,
  recordRestructuringPlan,
} from "@/lib/store";
import { MonitoringAction } from "@/lib/types";

const text = (value: unknown, max = 1000) => String(value || "").trim().slice(0, max);
const num = (value: unknown) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };
const bool = (value: unknown) => value === true || value === "true" || value === "1" || value === "on";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(req)) return csrfErrorResponse();
  const session = getBankSession(req);
  if (!session) return NextResponse.json({ error: "يجب تسجيل الدخول." }, { status: 401 });
  const { id } = await params;
  const current = await getFinancingRequest(id);
  if (!current) return NextResponse.json({ error: "الطلب غير موجود." }, { status: 404 });
  const actor = { userId: session.userId, name: session.name, role: session.role || "admin" as const };
  const isMultipart = (req.headers.get("content-type") || "").includes("multipart/form-data");
  const form = isMultipart ? await req.formData() : null;
  const body: Record<string, any> = form ? Object.fromEntries(form.entries()) : await req.json();
  const action = text(body.action, 80);

  try {
    if (action === "record_disbursement") {
      if (!hasBankPermission(session, "disburse")) return forbidden();
      const updated = await recordFinancingDisbursement(id, {
        amount: num(body.amount),
        mode: body.mode === "tranche" ? "tranche" : "full",
        beneficiaryName: text(body.beneficiaryName),
        beneficiaryIban: text(body.beneficiaryIban, 40).replace(/\s+/g, "").toUpperCase(),
        beneficiaryBank: text(body.beneficiaryBank),
        transferReference: text(body.transferReference, 100),
        disbursementDate: text(body.disbursementDate) || new Date().toISOString(),
        note: text(body.note),
      }, actor);
      return ok(updated);
    }

    if (action === "record_installment_payment") {
      if (!hasBankPermission(session, "add_monitoring")) return forbidden();
      const updated = await recordInstallmentPayment(id, text(body.installmentId), num(body.paidAmount), text(body.paidAt) || new Date().toISOString(), num(body.daysPastDue), actor);
      return ok(updated);
    }

    if (action === "monitoring_snapshot") {
      if (!hasBankPermission(session, "add_monitoring")) return forbidden();
      let sourceFile;
      const file = form?.get("statementFile");
      if (file instanceof File && file.name) sourceFile = (await saveUploadedFile(id, file, "monitoring_statement")).metadata;
      const previous = current.data.monitoring?.snapshots.at(-1);
      const snapshot = buildMonitoringSnapshot({
        period: text(body.period, 7),
        revenue: num(body.revenue),
        operatingCashFlow: num(body.operatingCashFlow),
        maintenanceCapex: num(body.maintenanceCapex),
        totalDebt: num(body.totalDebt),
        totalAssets: num(body.totalAssets),
        currentAssets: num(body.currentAssets),
        currentLiabilities: num(body.currentLiabilities),
        scheduledPrincipal: num(body.scheduledPrincipal),
        scheduledInterest: num(body.scheduledInterest),
        mandatoryDebtFees: num(body.mandatoryDebtFees),
        financeLeasePayments: num(body.financeLeasePayments),
        installmentDue: num(body.installmentDue),
        installmentPaid: num(body.installmentPaid),
        daysPastDue: num(body.daysPastDue),
        unlikelyToPay: bool(body.unlikelyToPay),
        bankruptcy: bool(body.bankruptcy),
        enforcementStarted: bool(body.enforcementStarted),
        distressedRestructuring: bool(body.distressedRestructuring),
        covenantBreach: bool(body.covenantBreach),
        ratingDowngrade: bool(body.ratingDowngrade),
        collateralDeterioration: bool(body.collateralDeterioration),
        sourceFileName: sourceFile?.originalName,
        notes: text(body.notes, 2000),
      }, previous);
      const updated = await addMonitoringSnapshotWithAudit(id, snapshot, actor, sourceFile);
      return ok(updated);
    }

    if (action === "add_monitoring_action") {
      if (!hasBankPermission(session, "add_monitoring")) return forbidden();
      const item: MonitoringAction = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        title: text(body.title),
        owner: text(body.owner) || session.name,
        dueDate: text(body.dueDate) || undefined,
        status: "open",
        note: text(body.note),
      };
      const updated = await addMonitoringAction(id, item, actor);
      return ok(updated);
    }

    if (action === "collection_event") {
      if (!hasBankPermission(session, "enforce_collateral") && !hasBankPermission(session, "add_monitoring")) return forbidden();
      const allowed = ["payment_reminder","promise_to_pay","collection_referral","legal_notice","collateral_enforcement","collateral_sale","recovery","closure"];
      const type = allowed.includes(body.type) ? body.type : "payment_reminder";
      const updated = await recordCollectionEvent(id, { type, amount: num(body.amount) || undefined, dueDate: text(body.dueDate) || undefined, note: text(body.note) || "تم تسجيل إجراء تحصيل." }, actor);
      return ok(updated);
    }

    if (action === "restructure") {
      if (!hasBankPermission(session, "final_decision")) return forbidden();
      const updated = await recordRestructuringPlan(id, {
        reason: text(body.reason),
        newAmount: num(body.newAmount),
        newRate: num(body.newRate),
        newTermMonths: Math.max(1, Math.round(num(body.newTermMonths))),
        gracePeriodMonths: Math.max(0, Math.round(num(body.gracePeriodMonths))),
        status: body.status === "approved" ? "approved" : "proposed",
      }, actor);
      return ok(updated);
    }

    return NextResponse.json({ error: "إجراء غير معروف." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تنفيذ العملية." }, { status: 400 });
  }
}

function forbidden() { return NextResponse.json({ error: "لا تملكين الصلاحية المطلوبة." }, { status: 403 }); }
function ok(value: any) { return NextResponse.json(withoutTicketSecurity(value), { headers: { "Cache-Control": "private, no-store" } }); }
