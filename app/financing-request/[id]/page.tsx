"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Landmark,
  Loader2,
  CheckCircle2,
  FileDown,
  ArrowRight,
  Info,
  Building2,
  Rocket,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  StoredReport,
  CompanyReportData,
  StartupReportData,
  PartnerBankQuote,
  RiskLevel,
} from "@/lib/types";
import { getPartnerBankQuote } from "@/lib/banks";
import { exportElementToPdf } from "@/lib/pdfExport";

const TERM_OPTIONS = [12, 24, 36, 48, 60];

export default function FinancingRequestPage() {
  const params = useParams<{ id: string }>();

  const [report, setReport] = useState<StoredReport | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [confirmation, setConfirmation] = useState<{
    id: string;
    bankQuote: PartnerBankQuote;
  } | null>(null);

  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [requestedAmount, setRequestedAmount] = useState<number>(0);
  const [purpose, setPurpose] = useState("");
  const [termMonths, setTermMonths] = useState(24);
  const [notes, setNotes] = useState("");

  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/reports/${params.id}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setReport(json);
        setRequestedAmount(getDefaultAmount(json));
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

  const { applicantName, sector, riskLevel } = getApplicantInfo(report);
  const quote = getPartnerBankQuote(riskLevel, requestedAmount || 1);

  async function handleSubmit() {
    if (!contactName.trim() || !phone.trim() || !requestedAmount) {
      setSubmitError("يرجى تعبئة اسم المسؤول ورقم الجوال والمبلغ المطلوب");
      return;
    }
    setSubmitError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/financing-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: params.id,
          contactName,
          phone,
          email,
          requestedAmount,
          purpose,
          termMonths,
          notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "حدث خطأ");
      setConfirmation({ id: json.id, bankQuote: json.bankQuote });
    } catch (e: any) {
      setSubmitError(e.message || "تعذر إرسال الطلب");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownloadPdf() {
    if (!summaryRef.current || !confirmation) return;
    await exportElementToPdf(
      summaryRef.current,
      `financial-pulse-financing-request-${confirmation.id.slice(0, 8)}.pdf`
    );
  }

  if (confirmation) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center mb-8">
          <CheckCircle2 className="w-14 h-14 text-risk-low mx-auto mb-4" />
          <h1 className="font-heading text-2xl font-bold mb-2">
            تم إرسال طلبك إلى البنك الشريك
          </h1>
          <p className="text-fp-slate text-sm">
            رقم الطلب: {confirmation.id.slice(0, 8)} — سيقوم فريق النبض المالي بمتابعة طلبك مع البنك الشريك والتواصل معك بالمستجدات
          </p>
        </div>

        <div
          ref={summaryRef}
          className="bg-white rounded-2xl p-6 md:p-8 shadow-card border border-black/5 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-black/10 pb-4">
            <div>
              <h2 className="font-heading text-lg font-bold">ملخص طلب التمويل</h2>
              <p className="text-xs text-fp-slate">النبض المالي — وسيطكم مع البنك الشريك</p>
            </div>
            <span className="text-xs text-fp-slate">
              {new Date().toLocaleDateString("ar-SA")}
            </span>
          </div>

          <SummaryRow label="مقدّم الطلب" value={applicantName} />
          <SummaryRow label="القطاع" value={sector} />
          <SummaryRow label="اسم المسؤول" value={contactName} />
          <SummaryRow label="رقم الجوال" value={phone} />
          {email && <SummaryRow label="البريد الإلكتروني" value={email} />}
          <SummaryRow
            label="المبلغ المطلوب"
            value={`${requestedAmount.toLocaleString("ar-SA")} ريال`}
          />
          <SummaryRow label="مدة السداد المفضلة" value={`${termMonths} شهراً`} />
          {purpose && <SummaryRow label="الغرض من التمويل" value={purpose} />}

          <div className="pt-4 border-t border-black/10">
            <p className="text-xs text-fp-slate mb-2">جهة التمويل</p>
            <div className="flex items-center gap-3 bg-fp-green/5 rounded-xl p-4">
              <Landmark className="w-8 h-8 text-fp-green flex-shrink-0" />
              <div>
                <p className="font-semibold">{confirmation.bankQuote.bank.name}</p>
                <p className="text-sm text-fp-slate">
                  نسبة فائدة تقديرية: {confirmation.bankQuote.estimatedRate}%
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <button
            onClick={handleDownloadPdf}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-fp-ink text-white font-semibold hover:opacity-90 transition-opacity"
          >
            <FileDown className="w-4 h-4" />
            تحميل ملخص الطلب PDF
          </button>
          <Link
            href={`/dashboard/${params.id}`}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-black/15 font-semibold hover:bg-black/5 transition-colors"
          >
            العودة إلى لوحة التحليل
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link
        href={`/dashboard/${params.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-fp-slate hover:text-fp-green mb-6 transition-colors"
      >
        <ArrowRight className="w-4 h-4" />
        العودة إلى لوحة التحليل
      </Link>

      <div className="flex items-center gap-2 mb-1">
        {report.type === "company" ? (
          <Building2 className="w-5 h-5 text-fp-green" />
        ) : (
          <Rocket className="w-5 h-5 text-fp-gold" />
        )}
        <h1 className="font-heading text-2xl font-bold">طلب تمويل — {applicantName}</h1>
      </div>
      <p className="text-fp-slate text-sm mb-8">{sector}</p>

      {/* Partner bank intro */}
      <div className="bg-white rounded-2xl p-6 shadow-card border border-black/5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Landmark className="w-5 h-5 text-fp-gold" />
          <h2 className="font-semibold">{quote.bank.name}</h2>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-fp-green/5 rounded-xl p-5">
          <div>
            <p className="text-sm text-fp-slate leading-relaxed">{quote.bank.strengths}</p>
            <ul className="mt-3 space-y-1">
              {quote.notes.map((n) => (
                <li key={n} className="text-xs text-fp-green flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-fp-green" /> {n}
                </li>
              ))}
            </ul>
          </div>
          <div className="text-center sm:text-left flex-shrink-0">
            <p className="text-xs text-fp-slate mb-0.5">نسبة الفائدة التقديرية</p>
            <p className="text-3xl font-bold text-fp-green">{quote.estimatedRate}%</p>
          </div>
        </div>

        {/* Middleman value proposition */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-black/[0.02]">
            <Zap className="w-4 h-4 text-fp-gold flex-shrink-0 mt-0.5" />
            <p className="text-xs text-fp-slate leading-relaxed">
              نُجهّز طلبك بجميع المؤشرات المالية والتحليل اللازم مسبقاً، لتسريع مراجعة البنك واختصار الإجراءات
            </p>
          </div>
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-black/[0.02]">
            <ShieldCheck className="w-4 h-4 text-fp-gold flex-shrink-0 mt-0.5" />
            <p className="text-xs text-fp-slate leading-relaxed">
              نتابع طلبك مع البنك الشريك وننسّق التواصل بينكما حتى صدور القرار النهائي
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 mt-4 text-xs text-fp-slate bg-black/[0.03] rounded-lg p-3">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            النسبة المعروضة تقدير أولي بناءً على المؤشرات المالية الحالية، وقد
            تختلف النسبة النهائية بعد مراجعة الطلب من قبل البنك الشريك.
          </span>
        </div>
      </div>

      {/* Request form */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-card border border-black/5 space-y-5">
        <h2 className="font-semibold">بيانات طلب التمويل</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="اسم الشخص المسؤول">
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="input"
              placeholder="الاسم الكامل"
            />
          </Field>
          <Field label="رقم الجوال">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
              placeholder="05xxxxxxxx"
            />
          </Field>
          <Field label="البريد الإلكتروني (اختياري)">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="example@company.com"
            />
          </Field>
          <Field label="المبلغ المطلوب (ريال)">
            <input
              type="number"
              value={requestedAmount || ""}
              onChange={(e) => setRequestedAmount(Number(e.target.value))}
              className="input"
            />
          </Field>
          <Field label="مدة السداد المفضلة">
            <select
              value={termMonths}
              onChange={(e) => setTermMonths(Number(e.target.value))}
              className="input bg-white"
            >
              {TERM_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t} شهراً
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="الغرض من التمويل">
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="input min-h-[80px]"
            placeholder="مثال: توسعة النشاط التشغيلي وشراء معدات جديدة"
          />
        </Field>

        <Field label="ملاحظات إضافية (اختياري)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input min-h-[70px]"
            placeholder="أي معلومات إضافية تود إضافتها للطلب"
          />
        </Field>

        {submitError && <p className="text-sm text-risk-high">{submitError}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-green-gradient text-white font-bold shadow-card hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? "جاري إرسال الطلب..." : "إرسال طلب التمويل إلى البنك الشريك"}
        </button>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          padding: 0.625rem 1rem;
          border-radius: 0.5rem;
          border: 1px solid rgba(0, 0, 0, 0.1);
        }
        .input:focus {
          outline: none;
          border-color: #0b3d2e;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-fp-slate">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function getDefaultAmount(report: StoredReport): number {
  if (report.type === "company") {
    return (report.data as CompanyReportData).funding.amount;
  }
  return (report.data as StartupReportData).fundingNeeded;
}

function getApplicantInfo(report: StoredReport): {
  applicantName: string;
  sector: string;
  riskLevel: RiskLevel;
} {
  if (report.type === "company") {
    const d = report.data as CompanyReportData;
    return { applicantName: d.companyName, sector: d.sector, riskLevel: d.risk.riskLevel };
  }
  const d = report.data as StartupReportData;
  const riskLevel: RiskLevel =
    d.successProbability >= 65 ? "low" : d.successProbability >= 45 ? "medium" : "high";
  return { applicantName: d.input.projectName, sector: d.input.sector, riskLevel };
}
