"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Props {
  company: { liquidityRatio: number; debtRatio: number; profitMargin: number };
  benchmark: { liquidityRatio: number; debtRatio: number; profitMargin: number };
}

export default function ComparisonChart({ company, benchmark }: Props) {
  const data = [
    { name: "نسبة السيولة", "الشركة": company.liquidityRatio, "متوسط القطاع": benchmark.liquidityRatio },
    { name: "نسبة المديونية", "الشركة": company.debtRatio, "متوسط القطاع": benchmark.debtRatio },
    { name: "هامش الربح", "الشركة": company.profitMargin, "متوسط القطاع": benchmark.profitMargin },
  ];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EFEFEC" />
        <XAxis dataKey="name" fontSize={12} />
        <YAxis fontSize={12} />
        <Tooltip />
        <Legend />
        <Bar dataKey="الشركة" fill="#0B3D2E" radius={[6, 6, 0, 0]} />
        <Bar dataKey="متوسط القطاع" fill="#C9A227" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
