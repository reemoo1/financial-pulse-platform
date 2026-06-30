import { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  label: string;
  value: string;
  trend?: "up" | "down" | "neutral";
}

export default function KPICard({ icon: Icon, label, value, trend = "neutral" }: Props) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-card border border-black/5">
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg bg-fp-green/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-fp-green" />
        </div>
      </div>
      <p className="text-xs text-fp-slate mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
