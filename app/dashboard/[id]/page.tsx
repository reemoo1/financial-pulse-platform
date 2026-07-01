"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  Banknote,
  Sparkles,
  Loader2,
  Target,
  Clock,
  Building2,
  Landmark,
} from "lucide-react";
import RiskGauge from "@/components/RiskGauge";
import KPICard from "@/components/KPICard";
import ComparisonChart from "@/components/charts/ComparisonChart";
import Vision2030Chart from "@/components/charts/Vision2030Chart";
import ExportToolbar from "@/components/ExportToolbar";
import { StoredReport, CompanyReportData, StartupReportData } from "@/lib/types";

export default function DashboardPage() {
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<StoredReport | null>(null);
  const [error, setError] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/reports/${params.id}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setReport(json);
      })
      .catch((e) => setError(e.message || "تعذر تحميل التقرير"));
  }, [params.id]);

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <p className="text-risk-high font-medium">{error}</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-fp-green" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-heading text-2xl font-bold">لوحة التحليل</h1>
          <p className="text-fp-slate text-sm">
            {new Date(report.createdAt).toLocaleString("ar-SA")}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ExportToolbar report={report} targetRef={contentRef} />
          <Link
            href={`/financing-request/${params.id}`}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gold-gradient text-fp-ink text-sm font-bold shadow-card hover:opacity-90 transition-opacity"
          >
            <Landmark className="w-4 h-4" />
            تقديم طلب تمويل
          </Link>
        </div>
      </div>

      <div ref={contentRef} className="space-y-6 bg-fp-paper p-1">
        {report.type === "company" ? (
          <CompanyDashboard data={report.data as CompanyReportData} />
        ) : (
          <StartupDashboard data={report.data as StartupReportData} />
        )}
      </div>
    </div>
  );
}

function CompanyDashboard({ data }: { data: CompanyReportData }) {
  return (
    <>
      <div className="bg-white rounded-2xl p-6 shadow-card border border-black/5 flex flex-col md:flex-row items-center gap-8">
        <RiskGauge value={data.risk.defaultProbability} riskLevel={data.risk.riskLevel} />
        <div className="flex-1 w-full">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-fp-green" />
            <h2 className="font-heading text-xl font-bold">{data.companyName}</h2>
          </div>
          <p className="text-sm text-fp-slate mb-4">{data.sector} · {data.city || "غير محدد"}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="توافق رؤية 2030" value={`${data.vision2030.score}%`} />
            <Stat label="التمويل الموصى به" value={`${data.funding.amount.toLocaleString("ar-SA")} ريال`} />
            <Stat label="نسبة الفائدة" value={`${data.funding.interestRate}%`} />
            <Stat label="التوصية" value={data.funding.recommendationText} small />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={Wallet} label="نسبة السيولة" value={String(data.ratios.liquidityRatio)} />
        <KPICard icon={TrendingDown} label="نسبة المديونية" value={`${(data.ratios.debtRatio * 100).toFixed(0)}%`} />
        <KPICard icon={TrendingUp} label="هامش الربح" value={`${(data.ratios.profitMargin * 100).toFixed(1)}%`} />
        <KPICard icon={Banknote} label="التدفق النقدي" value={`${data.ratios.cashFlow.toLocaleString("ar-SA")} ريال`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-card border border-black/5">
          <h3 className="font-semibold mb-4">مقارنة مع متوسط القطاع</h3>
          <ComparisonChart company={data.ratios} benchmark={data.benchmark} />
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-card border border-black/5">
          <h3 className="font-semibold mb-4">تفصيل توافق رؤية 2030</h3>
          <Vision2030Chart breakdown={data.vision2030.breakdown} />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-card border border-black/5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-fp-gold" />
          <h3 className="font-semibold">ملخص الذكاء الاصطناعي</h3>
        </div>
        <p className="text-sm leading-relaxed text-fp-slate">{data.narrative}</p>
      </div>
    </>
  );
}

function StartupDashboard({ data }: { data: StartupReportData }) {
  const riskLevel = data.successProbability >= 65 ? "low" : data.successProbability >= 45 ? "medium" : "high";

  return (
    <>
      <div className="bg-white rounded-2xl p-6 shadow-card border border-black/5 flex flex-col md:flex-row items-center gap-8">
        <RiskGauge value={data.successProbability} riskLevel={riskLevel} label="نسبة النجاح المتوقعة" />
        <div className="flex-1 w-full">
          <h2 className="font-heading text-xl font-bold mb-1">{data.input.projectName}</h2>
          <p className="text-sm text-fp-slate mb-4">{data.input.sector} · {data.input.city || "غير محدد"}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="توافق رؤية 2030" value={`${data.vision2030.score}%`} />
            <Stat label="رأس المال الموصى به" value={`${data.recommendedCapital.toLocaleString("ar-SA")} ريال`} />
            <Stat label="التمويل المطلوب" value={`${data.fundingNeeded.toLocaleString("ar-SA")} ريال`} />
            <Stat label="مدة الاسترداد" value={`${data.paybackMonths} شهر`} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-card border border-black/5">
          <h3 className="font-semibold mb-4">تفصيل توافق رؤية 2030</h3>
          <Vision2030Chart breakdown={data.vision2030.breakdown} />
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-card border border-black/5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-fp-green" />
            <h3 className="font-semibold">أفضل الجهات التمويلية</h3>
          </div>
          <ul className="space-y-2">
            {data.fundingSources.map((s) => (
              <li key={s} className="flex items-center gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-fp-gold" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-card border border-black/5">
        <h3 className="font-semibold mb-4">تحليل SWOT</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SwotBox title="نقاط القوة" items={data.swot.strengths} colorClass="text-risk-low" />
          <SwotBox title="نقاط الضعف" items={data.swot.weaknesses} colorClass="text-risk-high" />
          <SwotBox title="الفرص" items={data.swot.opportunities} colorClass="text-fp-green" />
          <SwotBox title="التهديدات" items={data.swot.threats} colorClass="text-risk-medium" />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-card border border-black/5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-fp-green" />
          <h3 className="font-semibold">خطة تطوير المشروع</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.roadmap.map((phase) => (
            <div key={phase.title} className="border border-black/10 rounded-xl p-4">
              <p className="text-xs text-fp-gold font-semibold mb-1">{phase.timeframe}</p>
              <h4 className="font-semibold mb-2">{phase.title}</h4>
              <ul className="space-y-1.5 text-sm text-fp-slate">
                {phase.items.map((it) => (
                  <li key={it}>· {it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-card border border-black/5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-fp-gold" />
          <h3 className="font-semibold">ملخص الذكاء الاصطناعي</h3>
        </div>
        <p className="text-sm leading-relaxed text-fp-slate">{data.narrative}</p>
      </div>
    </>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="bg-fp-paper rounded-lg px-3 py-2.5">
      <p className="text-xs text-fp-slate mb-0.5">{label}</p>
      <p className={small ? "text-sm font-semibold" : "font-bold"}>{value}</p>
    </div>
  );
}

function SwotBox({ title, items, colorClass }: { title: string; items: string[]; colorClass: string }) {
  return (
    <div className="border border-black/10 rounded-xl p-4">
      <h4 className={`font-semibold mb-2 ${colorClass}`}>{title}</h4>
      <ul className="space-y-1.5 text-sm text-fp-slate">
        {items.map((it) => (
          <li key={it}>· {it}</li>
        ))}
      </ul>
    </div>
  );
}
