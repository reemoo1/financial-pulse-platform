import { FINANCING_STATUS_LABELS } from "@/lib/financingLifecycle";
import { RiskLevel } from "@/lib/types";

export function money(value: number | null | undefined, compact = false) {
  const n = Number(value || 0);
  if (compact && Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toLocaleString("ar-SA", { maximumFractionDigits: 1 })} مليون ر.س`;
  }
  return `${Math.round(n).toLocaleString("ar-SA")} ر.س`;
}

export function pct(value: number | null | undefined, ratio = false) {
  if (value == null || !Number.isFinite(Number(value))) return "غير متوفر";
  const n = Number(value) * (ratio ? 100 : 1);
  return `${n.toLocaleString("ar-SA", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function date(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
}

export function RiskBadge({ risk }: { risk: RiskLevel | string }) {
  const normalized = String(risk || "medium").toLowerCase();
  const config =
    normalized === "low"
      ? { label: "مخاطر منخفضة", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" }
      : normalized === "high"
        ? { label: "مخاطر مرتفعة", cls: "bg-rose-50 text-rose-700 border-rose-200" }
        : { label: "مخاطر متوسطة", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  return <span className={`rounded-full border px-3 py-1 text-[10px] font-bold ${config.cls}`}>{config.label}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const approved = ["approved", "disbursed", "monitoring", "closed"].includes(status);
  const danger = ["rejected", "defaulted"].includes(status);
  const cls = approved
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : danger
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : "bg-[#F8FAFC] text-[#0B1F3A] border-[#D9E2EC]";
  return (
    <span className={`rounded-full border px-3 py-1 text-[10px] font-bold ${cls}`}>
      {FINANCING_STATUS_LABELS[status as keyof typeof FINANCING_STATUS_LABELS] || status}
    </span>
  );
}
