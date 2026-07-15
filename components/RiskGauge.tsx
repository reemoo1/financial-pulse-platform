"use client";

interface Props {
  value: number; // 0-100
  riskLevel: "low" | "medium" | "high";
  label?: string;
  /** ما يُعرض بعد الرقم: "%" للنِسب أو "/100" لدرجة الصحة */
  suffix?: string;
}

const COLORS = {
  low: "#1F8A5B",
  medium: "#C9793B",
  high: "#C23A3A",
};

const LABELS = {
  low: "منخفض",
  medium: "متوسط",
  high: "مرتفع",
};

export default function RiskGauge({
  value,
  riskLevel,
  label = "درجة الصحة المالية",
  suffix = "%",
}: Props) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = COLORS[riskLevel];

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-48">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r={radius} fill="none" stroke="#E8EDF4" strokeWidth="16" />
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-[#0F172A]" style={{ color }}>
            {value}
            <span className="text-xl font-semibold">{suffix}</span>
          </span>
          <span className="text-xs text-[#64748B] mt-1">{label}</span>
        </div>
      </div>
      <span
        className="mt-3 rounded-xl px-4 py-1.5 text-sm font-semibold text-white transition-colors duration-150"
        style={{ backgroundColor: color }}
      >
        مستوى المخاطر: {LABELS[riskLevel]}
      </span>
    </div>
  );
}
