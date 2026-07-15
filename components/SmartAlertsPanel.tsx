import { AlertTriangle, Bell, CheckCircle2, Info } from "lucide-react";
import { SmartAlert } from "@/lib/companyInsights";

type Props = {
  alerts: SmartAlert[];
  title?: string;
  className?: string;
};

const toneStyles: Record<
  SmartAlert["tone"],
  { border: string; bg: string; text: string; icon: typeof Info }
> = {
  info: {
    border: "border-[#D9E2EC]",
    bg: "bg-[#F8FAFC]",
    text: "text-[#0B1F3A]",
    icon: Info,
  },
  warning: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-900",
    icon: AlertTriangle,
  },
  danger: {
    border: "border-rose-200",
    bg: "bg-rose-50",
    text: "text-rose-900",
    icon: AlertTriangle,
  },
  success: {
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    text: "text-emerald-900",
    icon: CheckCircle2,
  },
};

export default function SmartAlertsPanel({
  alerts,
  title = "التنبيهات الذكية",
  className = "",
}: Props) {
  if (!alerts.length) return null;

  return (
    <section className={`portal-data-card p-5 sm:p-6 ${className}`}>
      <div className="mb-4 flex items-center gap-2">
        <div className="portal-icon-box h-9 w-9">
          <Bell className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-[#0F172A]">{title}</h3>
          <p className="text-xs text-[#64748B]">
            تنبيهات مبنية على البيانات المالية وحالة الطلب
          </p>
        </div>
      </div>
      <div className="space-y-3">
        {alerts.map((alert) => {
          const style = toneStyles[alert.tone];
          const Icon = style.icon;
          return (
            <div
              key={alert.id}
              className={`rounded-xl border p-4 ${style.border} ${style.bg}`}
            >
              <div className="flex items-start gap-3">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.text}`} />
                <div>
                  <p className={`text-sm font-semibold ${style.text}`}>
                    {alert.title}
                  </p>
                  <p className="mt-1 text-xs leading-6 text-[#475569]">
                    {alert.message}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
