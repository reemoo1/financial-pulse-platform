"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CompanyReportData } from "@/lib/types";
import { buildPerformanceComparison } from "@/lib/companyInsights";

type Props = {
  data: CompanyReportData;
};

export default function PerformanceComparisonChart({ data }: Props) {
  const comparison = buildPerformanceComparison(data);

  const percentMetrics = [
    {
      name: "نسبة المديونية",
      before: round1((comparison.before.debtRatio ?? 0) * 100),
      after: round1((comparison.after.debtRatio ?? 0) * 100),
      unit: "%",
    },
    {
      name: "الصحة المالية",
      before: round1(comparison.before.healthScore ?? 0),
      after: round1(comparison.after.healthScore ?? 0),
      unit: "%",
    },
    {
      name: "التدفق التشغيلي",
      before: round1((comparison.before.cashFlowRatio ?? 0) * 100),
      after: round1((comparison.after.cashFlowRatio ?? 0) * 100),
      unit: "%",
    },
  ];

  const timesMetrics = [
    {
      name: "DSCR",
      before: comparison.before.dscr ?? 0,
      after: comparison.after.dscr ?? 0,
    },
    {
      name: "السيولة",
      before: comparison.before.currentRatio ?? 0,
      after: comparison.after.currentRatio ?? 0,
    },
  ];

  const percentData = percentMetrics.map((item) => ({
    name: item.name,
    قبل: item.before,
    بعد: item.after,
  }));

  const timesData = timesMetrics.map((item) => ({
    name: item.name,
    قبل: item.before,
    بعد: item.after,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="portal-data-card p-5" dir="ltr">
          <h4 className="mb-4 font-semibold">مؤشرات نسبية — قبل وبعد التمويل</h4>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={percentData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(11, 31, 58, 0.08)" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} unit="%" width={42} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Legend />
              <Bar dataKey="قبل" fill="#C9793B" radius={[6, 6, 0, 0]} />
              <Bar dataKey="بعد" fill="#0B1F3A" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="portal-data-card p-5" dir="ltr">
          <h4 className="mb-4 font-semibold">مؤشرات تغطية — قبل وبعد التمويل</h4>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={timesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(11, 31, 58, 0.08)" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} width={30} />
              <Tooltip formatter={(v: number) => `${v} مرة`} />
              <Legend />
              <Bar dataKey="قبل" fill="#C9793B" radius={[6, 6, 0, 0]} />
              <Bar dataKey="بعد" fill="#0B1F3A" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="مبلغ التمويل" value={formatMoney(comparison.fundingAmount)} />
        <MiniStat
          label="القسط الشهري التقديري"
          value={formatMoney(comparison.monthlyInstallment || 0)}
        />
        <MiniStat
          label="DSCR بعد التمويل"
          value={
            comparison.after.dscr != null
              ? `${comparison.after.dscr.toFixed(2)} مرة`
              : "غير متاح"
          }
        />
        <MiniStat
          label="المديونية بعد التمويل"
          value={
            comparison.after.debtRatio != null
              ? `${(comparison.after.debtRatio * 100).toFixed(1)}%`
              : "غير متاح"
          }
        />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#D9E2EC] bg-[#F8FAFC] p-3">
      <p className="text-[11px] text-[#64748B]">{label}</p>
      <p className="mt-1 text-sm font-bold text-[#0F172A]">{value}</p>
    </div>
  );
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function formatMoney(value: number) {
  return `${value.toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ر.س`;
}
