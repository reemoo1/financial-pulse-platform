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

// ملاحظة تصميم: نسبة السيولة "مضاعف" (مرة) بينما المديونية وهامش الربح
// نِسَب مئوية — رسمها على محور واحد يجعل الهوامش تبدو شبه معدومة بجانب
// السيولة. لذلك نفصلها: مخطط للنسب المئوية ومخطط للمضاعفات.
export default function ComparisonChart({ company, benchmark }: Props) {
  const percentData = [
    {
      name: "نسبة المديونية",
      الشركة: round1(company.debtRatio * 100),
      "متوسط القطاع": round1(benchmark.debtRatio * 100),
    },
    {
      name: "هامش الربح",
      الشركة: round1(company.profitMargin * 100),
      "متوسط القطاع": round1(benchmark.profitMargin * 100),
    },
  ];

  const timesData = [
    {
      name: "نسبة السيولة",
      الشركة: round2(company.liquidityRatio),
      "متوسط القطاع": round2(benchmark.liquidityRatio),
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2" dir="ltr">
      <div className="col-span-2">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={percentData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(11, 31, 58, 0.08)" />
            <XAxis dataKey="name" fontSize={12} />
            <YAxis fontSize={12} unit="%" width={42} />
            <Tooltip formatter={(v: number) => `${v}%`} />
            <Legend />
            <Bar dataKey="الشركة" fill="#0B1F3A" radius={[6, 6, 0, 0]} />
            <Bar dataKey="متوسط القطاع" fill="#C9793B" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={timesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(11, 31, 58, 0.08)" />
            <XAxis dataKey="name" fontSize={12} />
            <YAxis fontSize={12} width={30} />
            <Tooltip formatter={(v: number) => `${v} مرة`} />
            <Bar dataKey="الشركة" fill="#0B1F3A" radius={[6, 6, 0, 0]} />
            <Bar dataKey="متوسط القطاع" fill="#C9793B" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
