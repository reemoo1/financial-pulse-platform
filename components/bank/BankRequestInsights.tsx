import {
  Bot,
  Calculator,
  Gauge,
  Landmark,
  ShieldAlert,
} from "lucide-react";
import { buildAiCreditRecommendation, AiCreditRecommendation } from "@/lib/creditAi";
import { deriveRequestProfile } from "@/lib/bankPortfolio";
import { CompanyReportData, StoredFinancingRequest } from "@/lib/types";
import { money, pct, RiskBadge } from "./BankUI";

type Profile = ReturnType<typeof deriveRequestProfile>;

type Props = {
  request: StoredFinancingRequest;
  company?: CompanyReportData | null;
  profile: Profile;
  suggestedAmount: number;
  suggestedRate: number;
  suggestedTerm: number;
  collateralReady: boolean;
  aiRecommendation?: AiCreditRecommendation;
};

export function BankRiskScorePanel({
  profile,
  company,
  aiRecommendation,
}: Pick<Props, "profile" | "company" | "aiRecommendation">) {
  const scorecard = aiRecommendation?.scorecard;
  const reasons = [
    `احتمال التعثر ${profile.pd.toFixed(1)}%`,
    `درجة الصحة المالية ${profile.health.toFixed(0)}%`,
    `درجة الإنذار المبكر ${profile.warning.toFixed(0)}%`,
    company?.ratios.dscr != null
      ? `DSCR يبلغ ${company.ratios.dscr.toFixed(2)} مرة`
      : "DSCR غير متاح بدقة",
    `المديونية ${((company?.ratios.debtRatio ?? 0) * 100).toFixed(1)}%`,
    `السيولة ${(company?.ratios.currentRatio ?? 0).toFixed(2)} مرة`,
  ];

  return (
    <section className="bank-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="bank-icon-box h-12 w-12">
            <Gauge className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#C9793B]">تقييم المخاطر</p>
            <h2 className="mt-1 text-xl font-bold">Risk Score</h2>
            <p className="mt-1 text-xs leading-6 text-slate-500">
              مستوى المخاطر وأسباب التقييم وفق البيانات والنموذج الائتماني
            </p>
          </div>
        </div>
        <RiskBadge risk={profile.risk} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ScoreTile label="النتيجة المجمعة" value={`${scorecard?.overall ?? Math.round(profile.health)} / 100`} />
        <ScoreTile label="القدرة على السداد" value={`${Math.round(scorecard?.capacity ?? 0)} / 100`} />
        <ScoreTile label="السيولة" value={`${Math.round(scorecard?.liquidity ?? 0)} / 100`} />
        <ScoreTile label="المخاطر" value={`${Math.round(scorecard?.risk ?? 100 - profile.health)} / 100`} />
      </div>

      <div className="mt-5 rounded-2xl border border-[#D9E2EC] bg-[#F8FAFC] p-4">
        <p className="text-xs font-bold text-[#0B1F3A]">أسباب التقييم</p>
        <ul className="mt-3 space-y-2">
          {reasons.map((reason) => (
            <li key={reason} className="flex gap-2 text-xs leading-5 text-slate-700">
              <span className="text-[#C9793B]">•</span>
              {reason}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function BankSystemDecisionPanel({
  aiRecommendation,
}: {
  aiRecommendation: AiCreditRecommendation;
}) {
  const decisionMeta = decisionLabel(aiRecommendation.decision);
  return (
    <section className="bank-card overflow-hidden">
      <div className="border-b border-slate-100 p-5">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-[#0B1F3A]" />
          <div>
            <h2 className="font-bold">قرار النظام</h2>
            <p className="mt-1 text-xs text-slate-500">
              توصية آلية للمراجعة — القرار النهائي يعود لموظف البنك
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <div className={`rounded-2xl border p-4 ${decisionMeta.className}`}>
          <p className="text-xs font-bold">{decisionMeta.label}</p>
          <p className="mt-2 text-sm font-semibold">
            الثقة: {aiRecommendation.confidence}%
          </p>
          <p className="mt-2 text-xs leading-6">{aiRecommendation.riskRecommendation}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-700">أسباب القرار</p>
          <ul className="mt-2 space-y-2">
            {aiRecommendation.rationale.map((item) => (
              <li key={item} className="text-xs leading-5 text-slate-600">
                • {item}
              </li>
            ))}
          </ul>
        </div>
        {aiRecommendation.reviewReasons.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-amber-800">
              <ShieldAlert className="h-4 w-4" />
              <p className="text-xs font-bold">تحتاج مراجعة إضافية</p>
            </div>
            <ul className="mt-2 space-y-1">
              {aiRecommendation.reviewReasons.map((item) => (
                <li key={item} className="text-xs leading-5 text-amber-900">
                  • {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export function BankSuggestedFinancingPanel({
  suggestedAmount,
  suggestedRate,
  suggestedTerm,
  profile,
  aiRecommendation,
}: Pick<
  Props,
  "suggestedAmount" | "suggestedRate" | "suggestedTerm" | "profile" | "aiRecommendation"
>) {
  const monthly =
    suggestedRate > 0
      ? (suggestedAmount * (suggestedRate / 100 / 12)) /
        (1 - Math.pow(1 + suggestedRate / 100 / 12, -suggestedTerm))
      : suggestedAmount / suggestedTerm;

  return (
    <section className="bank-card p-6">
      <div className="flex items-start gap-3">
        <div className="bank-icon-box h-12 w-12">
          <Calculator className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-[#C9793B]">التمويل المقترح</p>
          <h2 className="mt-1 text-xl font-bold">اقتراح النظام</h2>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            يقترح النظام المبلغ والمدة والقسط ومستوى المخاطر — ويمكن تعديلها من موظف البنك
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="مبلغ التمويل" value={money(suggestedAmount, true)} icon={Landmark} />
        <Summary label="مدة السداد" value={`${suggestedTerm} شهر`} icon={Calculator} />
        <Summary label="القسط الشهري" value={money(Math.round(monthly), true)} icon={Gauge} />
        <Summary label="مستوى المخاطر" value={<RiskBadge risk={profile.risk} />} icon={ShieldAlert} />
      </div>

      <div className="mt-4 rounded-2xl border border-[#D9E2EC] bg-[#F8FAFC] p-4 text-xs leading-6 text-slate-600">
        <p>
          النسبة المقترحة: <strong>{pct(suggestedRate)}</strong> · قرار النظام:{" "}
          <strong>{decisionLabel(aiRecommendation?.decision || "manual_review").short}</strong>
        </p>
        <p className="mt-2">
          يمكن تعديل هذه القيم من قسم «كيف حُسب التمويل المقترح؟» أو صفحة قرار الائتمان.
        </p>
      </div>
    </section>
  );
}

function ScoreTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}

function Summary({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: typeof Landmark;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 text-[10px] text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-sm font-bold text-slate-950">{value}</div>
    </div>
  );
}

function decisionLabel(decision: string) {
  if (decision === "approve") {
    return {
      label: "موافقة مقترحة",
      short: "موافقة",
      className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    };
  }
  if (decision === "conditional") {
    return {
      label: "موافقة مشروطة",
      short: "مشروط",
      className: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }
  if (decision === "reject") {
    return {
      label: "رفض مقترح",
      short: "رفض",
      className: "border-rose-200 bg-rose-50 text-rose-900",
    };
  }
  return {
    label: "تحتاج مراجعة إضافية",
    short: "مراجعة",
    className: "border-[#D9E2EC] bg-[#F8FAFC] text-[#0B1F3A]",
  };
}
