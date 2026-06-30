"use client";

interface Props {
  value: number; // 0-100
  riskLevel: "low" | "medium" | "high";
  label?: string;
}

const COLORS = {
  low: "#1E8E5A",
  medium: "#D9A441",
  high: "#C1462F",
};

const LABELS = {
  low: "منخفض",
  medium: "متوسط",
  high: "مرتفع",
};

export default function RiskGauge({ value, riskLevel, label = "احتمالية التعثر" }: Props) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = COLORS[riskLevel];

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-48">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r={radius} fill="none" stroke="#EFEFEC" strokeWidth="16" />
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
          <span className="text-4xl font-bold" style={{ color }}>
            {value}%
          </span>
          <span className="text-xs text-fp-slate mt-1">{label}</span>
        </div>
      </div>
      <span
        className="mt-3 px-4 py-1 rounded-full text-sm font-semibold text-white"
        style={{ backgroundColor: color }}
      >
        مستوى المخاطر: {LABELS[riskLevel]}
      </span>
    </div>
  );
}
