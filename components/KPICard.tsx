import { LucideIcon, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface Props {
  icon: LucideIcon;
  label: string;
  value: string;
  /** up = أفضل من المرجع (أخضر)، down = أضعف من المرجع (أحمر) */
  trend?: "up" | "down" | "neutral";
  /** نص صغير يشرح المرجع، مثل "مقابل متوسط القطاع" */
  trendHint?: string;
  /** حالة نقص بيانات مختلفة بصريًا عن التحذير أو النتيجة السلبية */
  unavailable?: boolean;
}

export default function KPICard({
  icon: Icon,
  label,
  value,
  trend = "neutral",
  trendHint,
  unavailable = false,
}: Props) {
  return (
    <div
      className={`portal-data-card p-5 transition-colors duration-150 ${
        unavailable
          ? "border-dashed border-[#D9E2EC] bg-[#F8FAFC]"
          : "hover:border-[#C9D4E0]"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`portal-icon-box h-9 w-9 ${unavailable ? "opacity-70" : ""}`}>
          <Icon className={`w-5 h-5 ${unavailable ? "text-[#64748B]" : ""}`} />
        </div>
        {unavailable ? (
          <span className="rounded-full bg-[#E8EDF4] px-2 py-0.5 text-[10px] font-semibold text-[#64748B]">
            بيانات غير مكتملة
          </span>
        ) : trend !== "neutral" && (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold rounded-full px-2 py-0.5 ${
              trend === "up"
                ? "text-emerald-700 bg-emerald-50"
                : "text-rose-700 bg-rose-50"
            }`}
            title={trendHint}
          >
            {trend === "up" ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            {trend === "up" ? "أفضل" : "أضعف"}
          </span>
        )}
      </div>
      <p className="text-xs text-[#64748B] mb-1">{label}</p>
      <p className={`text-xl font-bold text-[#0F172A] ${unavailable ? "text-[#64748B]" : ""}`}>
        {value}
      </p>
      {trendHint && (unavailable || trend !== "neutral") && (
        <p className="text-[10px] text-[#64748B] mt-1">{trendHint}</p>
      )}
    </div>
  );
}
