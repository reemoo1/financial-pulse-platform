import { CollateralPackage, FinancingRequestStatus } from "./types";

export function postApprovalFlowBlockers(input: {
  collateral?: CollateralPackage | null;
  status: FinancingRequestStatus;
  approvedAmount: number;
}) {
  const blockers: string[] = [];
  if (!(input.approvedAmount > 0)) blockers.push("مبلغ التمويل المعتمد غير صالح");
  if (!input.collateral) blockers.push("لم تُنشأ حزمة الضمانات");
  else {
    if (input.collateral.status !== "active") blockers.push("حزمة الضمانات غير مفعلة");
    if (!input.collateral.disbursementEligible) blockers.push("شروط الصرف غير مكتملة");
    if (input.collateral.shortfall > 0) blockers.push("يوجد عجز في تغطية الضمانات");
  }
  if (input.status === "rejected") blockers.push("الطلب مرفوض");
  return blockers;
}

export function canStartProfessionalMonitoring(input: {
  collateral?: CollateralPackage | null;
  status: FinancingRequestStatus;
  approvedAmount: number;
}) {
  return postApprovalFlowBlockers(input).length === 0;
}
