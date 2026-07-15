"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  Search,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import FinancingLifecycleCards from "@/components/FinancingLifecycleCards";
import InquiryMonitoringUpload from "@/components/InquiryMonitoringUpload";
import AuthShell from "@/components/AuthShell";
import SmartAlertsPanel from "@/components/SmartAlertsPanel";
import { buildInquiryAlerts } from "@/lib/companyInsights";
import {
  CollateralPackageStatus,
  FinancingJourneyStatus,
  FinancingLifecyclePlan,
} from "@/lib/types";

type InquiryResult = {
  requestId: string;
  ticketNumber: string;
  inquiryNumber: string;
  requestStatus: string;
  requestStatusCode: FinancingJourneyStatus;
  requestDetails: {
    applicantName: string;
    applicantType: "company" | "startup";
    sector: string;
    contactName: string;
    phone: string;
    email: string;
    requestedAmount: number;
    purpose: string;
    termMonths: number;
    financingProvider: string;
    estimatedRate: number;
  };
  submissionDate: string;
  lastUpdate: string;
  notes: string;
  uploadedFiles: {
    id: string;
    kind: string;
    originalName: string;
    size: number;
    uploadedAt: string;
  }[];
  submissionHistory: {
    status: string;
    statusCode: FinancingJourneyStatus;
    note: string;
    updatedAt: string;
    actor: string;
  }[];
  latestUpdates: string;
  lifecycle?: FinancingLifecyclePlan;
  creditDecision: {
    decision: "approved" | "conditional" | "rejected" | null;
    approvedAmount: number;
    approvedRate: number;
    approvedTermMonths: number;
    conditions: { id: string; title: string; required: boolean; status: string; note: string }[];
  } | null;
  operations: {
    totalDisbursed: number;
    remainingUndisbursed: number;
    disbursements: { id: string; amount: number; mode: string; disbursementDate: string; transferReference: string }[];
    installments: { id: string; sequence: number; dueDate: string; amountDue: number; paidAmount: number; daysPastDue: number; status: string }[];
  } | null;
  monitoring: {
    cadence: "monthly" | "quarterly";
    nextSubmissionDate: string | null;
    snapshots: { id: string; period: string; dscr: number; currentRatio: number; debtRatio: number; daysPastDue: number; healthScore: number; probabilityOfDefault: number; status: string; alerts: string[] }[];
    actions: { id: string; title: string; dueDate: string | null; status: string; note: string }[];
  } | null;
  collateralAction: {
    available: boolean;
    url: string | null;
    status: CollateralPackageStatus | null;
    requiredEligibleValue: number;
    requiredCoverageRatio: number;
    currentEligibleValue: number;
    coverageRatio: number;
    shortfall: number;
    canSubmit: boolean;
  };
};

export default function InquiryPage() {
  const [inquiryNumber, setInquiryNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"number" | "otp">("number");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpMessage, setOtpMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<InquiryResult | null>(null);

  async function handleSendOtp() {
    setError("");
    setOtpMessage("");

    if (!inquiryNumber.trim()) {
      setError("يرجى إدخال رقم الاستعلام");
      return;
    }

    setSendingOtp(true);
    try {
      const res = await fetch("/api/inquiries/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiryNumber }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "تعذر إرسال رمز التحقق");
      setOtpMessage(
        json.message || "تم إرسال رمز التحقق إلى بريدك الإلكتروني المسجل.",
      );
      setStep("otp");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "تعذر إرسال رمز التحقق",
      );
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleInquiry() {
    setError("");
    setResult(null);

    if (!inquiryNumber.trim() || otp.replace(/\D/g, "").length !== 6) {
      setError("يرجى إدخال رمز OTP المكوّن من 6 أرقام");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiryNumber, otp }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "تعذر تنفيذ الاستعلام");
      setResult(json);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "تعذر تنفيذ الاستعلام",
      );
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <section className="auth-workspace" dir="rtl">
        <div className="portal-page-wide space-y-6">
          <div className="auth-workspace-header">
            <div>
              <span className="portal-kicker">جلسة موثقة</span>
              <h1 className="mt-4 font-heading text-2xl font-bold text-[#0F172A] md:text-3xl">
                متابعة طلب التمويل
              </h1>
              <p className="mt-2 text-sm text-[#64748B]">
                رقم المعاملة {result.inquiryNumber}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setStep("number");
                setOtp("");
                setError("");
                setOtpMessage("");
              }}
              className="portal-secondary-btn text-sm"
            >
              استعلام جديد
            </button>
          </div>

          <div className="portal-card space-y-6 p-6 md:p-8">
            <div className="flex items-center justify-between gap-4 border-b border-[#E8EDF4] pb-4">
              <div>
                <h2 className="font-heading text-xl font-bold">تفاصيل الطلب</h2>
                <p className="text-xs text-fp-slate">
                  رقم التذكرة: {result.ticketNumber}
                </p>
              </div>
              <span className="portal-badge">{result.requestStatus}</span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <InfoRow
                label="مقدّم الطلب"
                value={result.requestDetails.applicantName}
              />
              <InfoRow label="القطاع" value={result.requestDetails.sector} />
              <InfoRow
                label="اسم المسؤول"
                value={result.requestDetails.contactName}
              />
              <InfoRow label="رقم الجوال" value={result.requestDetails.phone} />
              {result.requestDetails.email && (
                <InfoRow
                  label="البريد الإلكتروني"
                  value={result.requestDetails.email}
                />
              )}
              <InfoRow
                label="المبلغ المطلوب"
                value={formatMoney(result.requestDetails.requestedAmount)}
              />
              <InfoRow
                label="مدة السداد"
                value={`${result.requestDetails.termMonths} شهر`}
              />
              <InfoRow
                label="جهة التمويل"
                value={result.requestDetails.financingProvider}
              />
              <InfoRow
                label="نسبة الفائدة التقديرية"
                value={`${result.requestDetails.estimatedRate}%`}
              />
              <InfoRow
                label="تاريخ التقديم"
                value={formatDate(result.submissionDate)}
              />
              <InfoRow
                label="آخر تحديث"
                value={formatDate(result.lastUpdate)}
              />
            </div>

            {result.requestDetails.purpose && (
              <TextBlock
                label="تفاصيل الطلب"
                value={result.requestDetails.purpose}
              />
            )}
            <TextBlock label="الملاحظات" value={result.notes} />
            <TextBlock label="آخر التحديثات" value={result.latestUpdates} />

            {result.lifecycle && (
              <FinancingLifecycleCards
                lifecycle={result.lifecycle}
                title="رحلة الطلب والمتابعة"
              />
            )}

            {result.collateralAction.available &&
              result.collateralAction.url && (
                <CollateralActionCard action={result.collateralAction} />
              )}

            {(result.creditDecision || result.operations || result.monitoring) && (
              <PostApprovalWorkspace result={result} />
            )}

            {result.uploadedFiles.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 font-semibold">
                  <FileText className="h-4 w-4 text-[#0B1F3A]" />
                  المرفقات المحفوظة
                </h3>
                <div className="space-y-2">
                  {result.uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between rounded-xl border border-[#E8EDF4] bg-[#F8FAFC] px-4 py-3 text-sm"
                    >
                      <span>{file.originalName}</span>
                      <span className="text-xs text-fp-slate">
                        {(file.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <Clock3 className="h-4 w-4 text-[#0B1F3A]" />
                سجل الطلب
              </h3>
              <div className="space-y-3">
                {result.submissionHistory.map((item, index) => (
                  <div
                    key={`${item.updatedAt}-${index}`}
                    className="rounded-xl border border-[#D9E2EC] p-4"
                  >
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{item.status}</span>
                      <span className="text-xs text-fp-slate">
                        {formatDate(item.updatedAt)}
                      </span>
                    </div>
                    <p className="text-sm text-fp-slate">{item.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <AuthShell
      portalLabel="النبض المالي — متابعة الطلب"
      headline="تابع طلب التمويل بأمان عبر رقم المعاملة ورمز التحقق المرسل إلى بريدك."
      features={[
        "لا حاجة لإنشاء حساب أو كلمة مرور",
        "التحقق برمز OTP لمرة واحدة عبر البريد المسجل",
        "عرض القرار والضمانات والصرف في مكان واحد",
        "رفع المتابعة الشهرية بعد الموافقة والصرف",
      ]}
      steps={[
        {
          label: "رقم المعاملة",
          state: step === "number" ? "current" : "done",
        },
        {
          label: "رمز التحقق",
          state: step === "otp" ? "current" : "upcoming",
        },
      ]}
      panelTitle={step === "number" ? "أدخل رقم المعاملة" : "أدخل رمز التحقق"}
      panelSubtitle={
        step === "number"
          ? "استخدم الرقم الذي استلمته بعد تقديم طلب التمويل."
          : "أدخل الرمز المكوّن من 6 أرقام المرسل إلى بريدك الإلكتروني."
      }
      footer={
        step === "otp" ? (
          <div className="flex items-center justify-between gap-3 text-xs">
            <button
              type="button"
              onClick={() => {
                setStep("number");
                setOtp("");
                setError("");
              }}
              className="portal-link text-xs"
            >
              تغيير رقم الاستعلام
            </button>
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={sendingOtp}
              className="portal-link text-xs disabled:opacity-60"
            >
              {sendingOtp ? "جاري إعادة الإرسال..." : "إعادة إرسال الرمز"}
            </button>
          </div>
        ) : undefined
      }
    >
      {step === "number" ? (
        <>
          <label>
            <span className="auth-field-label">رقم الاستعلام</span>
            <input
              value={inquiryNumber}
              onChange={(event) => setInquiryNumber(event.target.value)}
              className="fp-input"
              placeholder="مثال: رقم التذكرة"
            />
          </label>

          {error && <div className="auth-alert mt-4">{error}</div>}

          <button
            onClick={handleSendOtp}
            disabled={sendingOtp}
            className="portal-primary-btn mt-5 w-full disabled:opacity-60"
          >
            {sendingOtp ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {sendingOtp ? "جاري الإرسال..." : "إرسال رمز التحقق"}
          </button>

          <div className="auth-trust-row">
            <ShieldCheck className="h-4 w-4" />
            <span>لن يُعرض أي محتوى قبل التحقق من رقم المعاملة ورمز OTP.</span>
          </div>
        </>
      ) : (
        <>
          <div className="auth-note">{otpMessage || "تم إرسال رمز التحقق إلى بريدك الإلكتروني المسجل."}</div>

          <label className="mt-4 block">
            <span className="auth-field-label">رمز OTP</span>
            <input
              value={otp}
              onChange={(event) =>
                setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="fp-input auth-otp-input"
              inputMode="numeric"
              placeholder="000000"
              autoFocus
            />
          </label>

          {error && <div className="auth-alert mt-4">{error}</div>}

          <button
            onClick={handleInquiry}
            disabled={loading}
            className="portal-primary-btn mt-5 w-full disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {loading ? "جاري الاستعلام..." : "فتح متابعة الطلب"}
          </button>
        </>
      )}
    </AuthShell>
  );
}

function PostApprovalWorkspace({ result }: { result: InquiryResult }) {
  const decision = result.creditDecision;
  const operations = result.operations;
  const monitoring = result.monitoring;
  const installments = operations?.installments || [];
  const nextInstallment = installments.find((item) => item.status !== "paid" && item.status !== "waived");
  const nextInstallments = installments.filter((item) => item.status !== "paid" && item.status !== "waived").slice(0, 6);
  const latestSnapshot = monitoring?.snapshots.at(-1);
  const requiredDocuments = [
    { label: "القوائم المالية الدورية", ready: (monitoring?.snapshots.length || 0) > 0 },
    { label: "كشف حساب بنكي", ready: result.uploadedFiles.some((f) => f.kind.includes("bank")) },
    { label: "مستندات الضمان", ready: result.collateralAction.currentEligibleValue > 0 },
    { label: "سجل السداد", ready: installments.some((item) => item.paidAmount > 0) },
  ];
  const inquiryAlerts = buildInquiryAlerts({
    requestStatusCode: result.requestStatusCode,
    totalDisbursed: operations?.totalDisbursed,
    remainingUndisbursed: operations?.remainingUndisbursed,
    nextInstallmentDue: nextInstallment?.dueDate,
    nextInstallmentAmount: nextInstallment?.amountDue,
    daysPastDue: nextInstallment?.daysPastDue,
    monitoringAlerts: latestSnapshot?.alerts,
    nextSubmissionDate: monitoring?.nextSubmissionDate,
    decision: decision?.decision,
  });

  return (
    <section className="inquiry-operations">
      <div className="inquiry-operations-heading">
        <div className="flex items-start gap-3">
          <div className="inquiry-operations-icon"><Banknote className="h-5 w-5" /></div>
          <div>
            <p className="portal-section-label">متابعة التمويل</p>
            <h3 className="mt-1 text-lg font-bold">التشغيل، الأقساط، والمتابعة الدورية</h3>
            <p className="mt-1 text-xs leading-6 text-fp-slate">تظهر هذه المعلومات داخل الاستعلام الآمن دون الحاجة إلى حساب أو لوحة شركة مستقلة.</p>
          </div>
        </div>
      </div>

      <SmartAlertsPanel alerts={inquiryAlerts} title="تنبيهات المتابعة" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="التمويل المصروف" value={formatMoney(operations?.totalDisbursed || 0)} />
        <MiniStat label="المبلغ المتبقي" value={formatMoney(operations?.remainingUndisbursed || 0)} />
        <MiniStat label="عدد الأقساط" value={`${installments.length}`} />
        <MiniStat
          label="القسط القادم"
          value={
            nextInstallment
              ? `${formatMoney(nextInstallment.amountDue)} · ${formatDateOnly(nextInstallment.dueDate)}`
              : "لا يوجد"
          }
        />
      </div>

      {decision && (
        <div className="inquiry-decision-line">
          <div><span>القرار</span><strong>{decisionLabel(decision.decision)}</strong></div>
          <div><span>المبلغ المعتمد/الموصى</span><strong>{formatMoney(decision.approvedAmount)}</strong></div>
          <div><span>النسبة</span><strong>{decision.approvedRate ? `${decision.approvedRate.toFixed(2)}%` : "قيد الاعتماد"}</strong></div>
          <div><span>المدة</span><strong>{decision.approvedTermMonths} شهر</strong></div>
        </div>
      )}

      {decision?.conditions.length ? (
        <div className="inquiry-subsection">
          <h4><CheckCircle2 className="h-4 w-4" />شروط الموافقة</h4>
          <div className="inquiry-condition-list">
            {decision.conditions.map((condition) => (
              <div key={condition.id} className="inquiry-condition-line">
                <span className={condition.status === "verified" || condition.status === "waived" ? "is-done" : "is-pending"} />
                <div><p>{condition.title}</p>{condition.note && <small>{condition.note}</small>}</div>
                <strong>{conditionStatusLabel(condition.status)}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="inquiry-subsection">
        <h4><FileText className="h-4 w-4" />المستندات المطلوبة</h4>
        <div className="grid gap-2 sm:grid-cols-2">
          {requiredDocuments.map((doc) => (
            <div
              key={doc.label}
              className={`rounded-xl border px-4 py-3 text-xs ${
                doc.ready
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-[#D9E2EC] bg-[#F8FAFC] text-[#475569]"
              }`}
            >
              <span className="font-semibold">{doc.label}</span>
              <span className="mt-1 block">{doc.ready ? "مستوفى" : "مطلوب"}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <div className="inquiry-subsection">
          <h4><CalendarDays className="h-4 w-4" />جدول الأقساط والسداد</h4>
          {operations?.disbursements.length ? (
            <div className="mb-4 border-r-2 border-emerald-500 pr-3 text-xs leading-6 text-emerald-800">
              تم صرف {formatMoney(operations.totalDisbursed)}، والمتبقي غير المصروف {formatMoney(operations.remainingUndisbursed)}.
            </div>
          ) : (
            <p className="mb-4 text-xs text-fp-slate">لم تُسجل عملية صرف فعلية حتى الآن.</p>
          )}
          {nextInstallments.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px] text-right text-xs">
                <thead><tr><th>القسط</th><th>تاريخ الاستحقاق</th><th>المستحق</th><th>المدفوع</th><th>الحالة</th></tr></thead>
                <tbody>{nextInstallments.map((item) => <tr key={item.id}><td>#{item.sequence}</td><td>{formatDateOnly(item.dueDate)}</td><td>{formatMoney(item.amountDue)}</td><td>{formatMoney(item.paidAmount)}</td><td><span className={`installment-status is-${item.status}`}>{installmentStatusLabel(item.status)}</span>{item.daysPastDue > 0 && <small className="block mt-1 text-rose-600">متأخر {item.daysPastDue} يوم</small>}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="py-6 text-center text-xs text-fp-slate">يُنشأ جدول الأقساط بعد تسجيل الصرف.</p>}
        </div>

        <div className="inquiry-subsection">
          <h4><TrendingUp className="h-4 w-4" />المتابعة الشهرية والإنذار المبكر</h4>
          {latestSnapshot ? (
            <>
              <div className="inquiry-monitor-grid">
                <MiniStat label="الفترة" value={latestSnapshot.period} />
                <MiniStat label="DSCR" value={`${latestSnapshot.dscr.toFixed(2)} مرة`} />
                <MiniStat label="الصحة المالية" value={`${latestSnapshot.healthScore.toFixed(0)}%`} />
                <MiniStat label="احتمال التعثر" value={`${latestSnapshot.probabilityOfDefault.toFixed(1)}%`} />
              </div>
              {latestSnapshot.alerts.length > 0 && <div className="inquiry-alert"><AlertTriangle className="h-4 w-4" /><div>{latestSnapshot.alerts.map((alert) => <p key={alert}>• {alert}</p>)}</div></div>}
            </>
          ) : <p className="py-6 text-center text-xs text-fp-slate">تبدأ المتابعة الدورية بعد الصرف ورفع أول كشف أو قائمة شهرية.</p>}
          {monitoring?.nextSubmissionDate && <p className="mt-4 border-t border-[#D9E2EC] pt-3 text-xs text-fp-slate">موعد التحديث القادم: <strong>{formatDateOnly(monitoring.nextSubmissionDate)}</strong></p>}
          {monitoring?.actions.length ? <div className="mt-4 space-y-2">{monitoring.actions.map((action) => <div key={action.id} className="inquiry-action-line"><span>{action.title}</span><small>{action.dueDate ? formatDateOnly(action.dueDate) : "دون موعد"}</small></div>)}</div> : null}
          <InquiryMonitoringUpload requestId={result.requestId} />
        </div>
      </div>
    </section>
  );
}

function CollateralActionCard({
  action,
}: {
  action: InquiryResult["collateralAction"];
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#D9E2EC] bg-[#F8FAFC]">
      <div className="flex flex-col gap-5 p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0B1F3A] text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="portal-section-label">
              مرحلة ما قبل الصرف
            </p>
            <h3 className="mt-1 text-lg font-bold">
              {action.canSubmit
                ? "مطلوب استكمال الضمانات"
                : "متابعة ملف الضمانات"}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-fp-slate">
              {action.canSubmit
                ? "أدخل بيانات الضمان وارفع المستندات المطلوبة ثم أرسل الحزمة للبنك للمراجعة."
                : "تم إرسال الحزمة أو اعتمادها، ويمكنك فتحها لمتابعة التحقق والحالة الحالية."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniStat
            label="الضمان المؤهل المطلوب"
            value={formatMoney(action.requiredEligibleValue)}
          />
          <MiniStat
            label="نسبة التغطية المطلوبة"
            value={formatPercentRatio(action.requiredCoverageRatio)}
          />
          <MiniStat
            label="المعتمد حاليًا"
            value={formatMoney(action.currentEligibleValue)}
          />
          <MiniStat
            label="التغطية المعتمدة"
            value={formatPercentRatio(action.coverageRatio)}
          />
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-[#D9E2EC] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#475569]">
            العجز الحالي بعد اعتماد البنك: {formatMoney(action.shortfall)}
          </p>
          <Link
            href={action.url || "/inquiry"}
            className="portal-primary-btn px-5 py-3 text-sm"
          >
            {action.canSubmit ? "استكمال الضمانات" : "عرض حالة الضمانات"}
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#D9E2EC] bg-white p-3">
      <p className="text-[11px] text-fp-slate">{label}</p>
      <p className="mt-1 font-bold tabular-nums">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#F8FAFC] p-4">
      <p className="mb-1 text-xs text-fp-slate">{label}</p>
      <p className="break-all font-medium">{value || "غير مدخل"}</p>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#F8FAFC] p-4">
      <p className="mb-2 text-xs text-fp-slate">{label}</p>
      <p className="text-sm leading-relaxed">{value || "غير مدخل"}</p>
    </div>
  );
}

function decisionLabel(value: string | null) { return ({ approved: "موافقة نهائية", conditional: "موافقة مشروطة", rejected: "مرفوض" } as Record<string,string>)[value || ""] || "قيد المراجعة"; }
function conditionStatusLabel(value: string) { return ({ pending: "بانتظار الاستيفاء", submitted: "مرفوع للمراجعة", verified: "مستوفى", waived: "تم الإعفاء" } as Record<string,string>)[value] || value; }
function installmentStatusLabel(value: string) { return ({ upcoming: "قادم", due: "مستحق", partial: "مسدد جزئياً", paid: "مسدد", late: "متأخر", waived: "معفى" } as Record<string,string>)[value] || value; }
function formatDateOnly(value: string) { if (!value) return "غير متوفر"; return new Date(value).toLocaleDateString("ar-SA-u-ca-gregory", { dateStyle: "medium" }); }

function formatDate(value: string) {
  if (!value) return "غير متوفر";
  return new Date(value).toLocaleString("ar-SA-u-ca-gregory", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatMoney(value: number) {
  return `${Math.round(value || 0).toLocaleString("ar-SA")} ريال`;
}

function formatPercentRatio(value: number) {
  return `${(Math.max(value || 0, 0) * 100).toLocaleString("ar-SA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;
}
