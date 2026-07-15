"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Gauge, Radar as RadarIcon } from "lucide-react";
import { CompanyReportData } from "@/lib/types";

export default function BankAnalysisCharts({
  company,
  health,
  probabilityOfDefault,
}: {
  company: CompanyReportData;
  health: number;
  probabilityOfDefault: number;
}) {
  const componentData = (company.risk.components || []).map((item) => ({
    metric: item.label,
    score: clamp(item.score),
  }));

  const radarData = componentData.length >= 3
    ? componentData
    : [
        { metric: "السيولة", score: ratioScore(company.ratios.currentRatio, 2) },
        { metric: "المديونية", score: clamp((1 - Number(company.ratios.debtRatio || 0)) * 100) },
        { metric: "الربحية", score: marginScore(company.ratios.netProfitMargin) },
        { metric: "التدفق النقدي", score: marginScore(company.ratios.operatingCashFlowRatio) },
        { metric: "جودة الأصول", score: clamp(Number(company.ratios.equityRatio || 0) * 100) },
      ];

  const comparison = [
    {
      metric: "السيولة",
      company: ratioScore(company.ratios.currentRatio, 2),
      sector: ratioScore(company.benchmark.liquidityRatio, 2),
    },
    {
      metric: "المديونية",
      company: clamp((1 - Number(company.ratios.debtRatio || 0)) * 100),
      sector: clamp((1 - Number(company.benchmark.debtRatio || 0)) * 100),
    },
    {
      metric: "الربحية",
      company: marginScore(company.ratios.netProfitMargin),
      sector: marginScore(company.benchmark.profitMargin),
    },
  ];

  const healthData = [
    { name: "الصحة المالية", value: clamp(health), fill: "#2563eb" },
    { name: "هامش الأمان", value: clamp(100 - probabilityOfDefault), fill: "#38bdf8" },
  ];

  return (
    <section className="bank-analysis-section" id="credit-charts">
      <div className="bank-section-heading">
        <div className="bank-section-icon"><BarChart3 className="h-5 w-5" /></div>
        <div>
          <h2>الرسوم البيانية الائتمانية</h2>
        </div>
      </div>

      <div className="bank-chart-grid">
        <article className="bank-chart-panel">
          <div className="bank-chart-title"><RadarIcon className="h-4 w-4" /><span>مؤشرات المخاطر الرئيسية</span></div>
          <div className="h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke="#dbeafe" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "#475569" }} />
                <Radar dataKey="score" stroke="#2563eb" fill="#60a5fa" fillOpacity={0.34} />
                <Tooltip formatter={(value) => `${Number(value).toFixed(0)}%`} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="bank-chart-panel">
          <div className="bank-chart-title"><BarChart3 className="h-4 w-4" /><span>الشركة مقارنة بمتوسط القطاع</span></div>
          <p className="bank-chart-note">مؤشر نسبي موحد من 0 إلى 100 لتسهيل المقارنة بين نسب بوحدات مختلفة.</p>
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparison} margin={{ top: 12, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#e2e8f0" />
                <XAxis dataKey="metric" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => `${Number(value).toFixed(0)}%`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar name="الشركة" dataKey="company" fill="#38bdf8" radius={[7, 7, 0, 0]} />
                <Bar name="متوسط القطاع" dataKey="sector" fill="#6366f1" radius={[7, 7, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="bank-chart-panel">
          <div className="bank-chart-title"><Gauge className="h-4 w-4" /><span>الصحة المالية وهامش الأمان</span></div>
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="28%" outerRadius="92%" data={healthData} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar dataKey="value" background cornerRadius={10} />
                <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="bank-chart-summary">
            <span>درجة الصحة <strong>{clamp(health).toFixed(0)}%</strong></span>
            <span>احتمال التعثر <strong>{clamp(probabilityOfDefault).toFixed(1)}%</strong></span>
          </div>
        </article>
      </div>
    </section>
  );
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function ratioScore(value: number | null | undefined, target: number) {
  return clamp((Number(value || 0) / target) * 100);
}

function marginScore(value: number | null | undefined) {
  const ratio = Number(value || 0);
  return clamp(50 + ratio * 250);
}
