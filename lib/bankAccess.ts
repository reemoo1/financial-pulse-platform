import { BankPermission, BankRole } from "./types";

export const BANK_ROLE_LABELS: Record<BankRole, string> = {
  admin: "المفوض الائتماني / مدير النظام",
  credit_analyst: "محلل ائتماني",
  risk_manager: "مدير مخاطر",
  operations: "عمليات التمويل",
  auditor: "مراجع داخلي",
};

const ROLE_PERMISSIONS: Record<BankRole, BankPermission[]> = {
  admin: ["view_dashboard","view_requests","submit_recommendation","final_decision","disburse","view_monitoring","add_monitoring","manage_users","view_audit","view_collateral","manage_collateral","approve_collateral","perfect_collateral","enforce_collateral"],
  credit_analyst: ["view_dashboard","view_requests","submit_recommendation","view_monitoring","view_collateral","manage_collateral"],
  risk_manager: ["view_dashboard","view_requests","submit_recommendation","final_decision","view_monitoring","add_monitoring","view_audit","view_collateral","manage_collateral","approve_collateral","enforce_collateral"],
  operations: ["view_dashboard","view_requests","disburse","view_monitoring","add_monitoring","view_collateral","perfect_collateral","enforce_collateral"],
  auditor: ["view_dashboard","view_requests","view_monitoring","view_audit","view_collateral"],
};

export function effectiveRole(session: { role?: BankRole } | null | undefined): BankRole {
  return session?.role || "admin";
}

export function hasBankPermission(session: { role?: BankRole } | null | undefined, permission: BankPermission) {
  return ROLE_PERMISSIONS[effectiveRole(session)].includes(permission);
}

export function rolePermissions(role: BankRole) {
  return ROLE_PERMISSIONS[role];
}
