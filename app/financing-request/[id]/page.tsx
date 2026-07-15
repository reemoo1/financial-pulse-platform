"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  FileDown,
  FileText,
  Landmark,
  Loader2,
  ShieldCheck,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import {
  CompanyReportData,
  FinancingLifecyclePlan,
  PartnerBankQuote,
  RiskLevel,
  StartupReportData,
  StoredReport,
} from "@/lib/types";
import { getPartnerBankQuote } from "@/lib/banks";
import { exportElementToPdf } from "@/lib/pdfExport";
import FinancingLifecycleCards from "@/components/FinancingLifecycleCards";

const TERM_OPTIONS = [12, 24, 36, 48, 60];

type RequiredDocumentKey =
  | "bankStatementFile"
  | "commercialRegistrationFile"
  | "ownerIdentityFile";
type OptionalDocumentKey = "fundUsePlanFile" | "feasibilityStudyFile";
type DocumentKey = RequiredDocumentKey | OptionalDocumentKey;

type DocumentDefinition = {
  key: DocumentKey | "financialStatements";
  title: string;
  description: string;
  required: boolean;
  completedByReport?: boolean;
  accept: string;
};

const DOCUMENTS: DocumentDefinition[] = [
  {
    key: "financialStatements",
    title: "القوائم المالية",
    description: "تم رفعها في خطوة التقييم المالي، ويمكن أن تكون Excel أو PDF.",
    required: true,
    completedByReport: true,
    accept: ".xlsx,.xls,.csv,.pdf",
  },
  {
    key: "bankStatementFile",
    title: "كشف الحساب البنكي لآخر 6 أشهر",
    description: "PDF أو Excel واضح يبين حركة الحساب والتدفقات الفعلية.",
    required: true,
    accept: ".pdf,.xlsx,.xls,.csv",
  },
  {
    key: "commercialRegistrationFile",
    title: "مستند السجل التجاري",
    description: "نسخة سارية وواضحة من السجل التجاري.",
    required: true,
    accept: ".pdf,.png,.jpg,.jpeg",
  },
  {
    key: "ownerIdentityFile",
    title: "هوية مالك الشركة أو المفوض بالتوقيع",
    description: "نسخة واضحة من الهوية الوطنية أو الإقامة للمفوض.",
    required: true,
    accept: ".pdf,.png,.jpg,.jpeg",
  },
  {
    key: "fundUsePlanFile",
    title: "خطة استخدام مبلغ التمويل",
    description: "اختيارية، وتساعد البنك على فهم توزيع المبلغ ومراحله.",
    required: false,
    accept: ".pdf,.xlsx,.xls,.csv",
  },
  {
    key: "feasibilityStudyFile",
    title: "دراسة الجدوى",
    description: "اختيارية حسب نوع التمويل أو المشروع المراد تنفيذه.",
    required: false,
    accept: ".pdf,.xlsx,.xls",
  },
];

export default function FinancingRequestPage() {
  const params = useParams<{ id: string }>();
  const summaryRef = useRef<HTMLDivElement>(null);
  const [report, setReport] = useState<StoredReport | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [confirmation, setConfirmation] = useState<{
    id: string;
    ticketNumber: string;
    inquiryNumber: string;
    otpSentToEmail: boolean;
    bankQuote: PartnerBankQuote;
    lifecycle?: FinancingLifecyclePlan;
  } | null>(null);

  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [requestedAmount, setRequestedAmount] = useState(0);
  const [purpose, setPurpose] = useState("");
  const [termMonths, setTermMonths] = useState(24);
  const [notes, setNotes] = useState("");
  const [crNumber, setCrNumber] = useState("");
  const [detailedActivity, setDetailedActivity] = useState("");
  const [establishmentDate, setEstablishmentDate] = useState("");
  const [companyAgeYears, setCompanyAgeYears] = useState(0);
  const [ownerName, setOwnerName] = useState("");
  const [ownerNationalId, setOwnerNationalId] = useState("");
  const [documents, setDocuments] = useState<Partial<Record<DocumentKey, File>>>({});

  useEffect(() => {
    fetch(`/api/reports/${params.id}`)
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "تعذر تحميل التقرير");
        setReport(json);
        setRequestedAmount(getDefaultAmount(json));
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "تعذر تحميل التقرير"));
  }, [params.id]);

  useEffect(() => {
    fetch("/api/company/profile")
      .then(async (response) => (response.ok ? response.json() : null))
      .then((profile) => {
        if (!profile) return;
        setCrNumber(profile.crNumber || "");
        setDetailedActivity(profile.detailedActivity || "");
        setEstablishmentDate(profile.establishmentDate || "");
        setCompanyAgeYears(Number(profile.companyAgeYears || 0));
        setPhone(profile.phone || "");
        setEmail(profile.email || "");
        setOwnerName(profile.ownerName || profile.contactName || "");
      })
      .catch(() => undefined);
  }, []);

  const applicant = useMemo(() => (report ? getApplicantInfo(report) : null), [report]);
  const visibleDocuments = useMemo(
    () => DOCUMENTS.filter((item) => item.key !== "feasibilityStudyFile" || report?.type === "startup"),
    [report?.type],
  );
  const quote = useMemo(() => {
    if (!report || !applicant) return null;
    const company = report.type === "company" ? (report.data as CompanyReportData) : null;
    return getPartnerBankQuote({
      riskLevel: applicant.riskLevel,
      loanAmount: requestedAmount || 1,
      analyzedRate: company?.funding.interestRate,
      recommendedAmount: company?.funding.amount,
      termMonths,
    });
  }, [applicant, report, requestedAmount, termMonths]);

  function updateEstablishmentDate(value: string) {
    setEstablishmentDate(value);
    const timestamp = value ? new Date(value).getTime() : Number.NaN;
    setCompanyAgeYears(Number.isFinite(timestamp) ? Math.max(0, Math.floor((Date.now() - timestamp) / 31_557_600_000)) : 0);
  }

  function setDocument(key: DocumentKey, file: File | null) {
    setDocuments((current) => {
      const next = { ...current };
      if (file) next[key] = file;
      else delete next[key];
      return next;
    });
  }

  function validateForm() {
    const missingFields: string[] = [];
    if (!crNumber.trim()) missingFields.push("رقم السجل التجاري");
    if (!establishmentDate) missingFields.push("تاريخ تأسيس الشركة");
    if (!detailedActivity.trim()) missingFields.push("النشاط التفصيلي");
    if (!ownerName.trim()) missingFields.push("اسم مالك الشركة أو المفوض");
    if (!/^\d{10}$/.test(ownerNationalId)) missingFields.push("رقم هوية صحيح من 10 أرقام");
    if (!contactName.trim()) missingFields.push("اسم مسؤول التواصل");
    if (!/^05\d{8}$/.test(phone.replace(/\s/g, ""))) missingFields.push("رقم جوال سعودي صحيح");
    if (!(requestedAmount > 0)) missingFields.push("مبلغ التمويل");
    const missingDocuments = visibleDocuments.filter(
      (item) => item.required && !item.completedByReport && !documents[item.key as RequiredDocumentKey],
    ).map((item) => item.title);
    if (missingDocuments.length) missingFields.push(...missingDocuments);
    return missingFields;
  }

  async function handleSubmit() {
    const missing = validateForm();
    if (missing.length) {
      setSubmitError(`أكملي البيانات التالية: ${missing.join("، ")}`);
      return;
    }
    setSubmitError("");
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("reportId", params.id);
      formData.append("submissionMode", "manual");
      formData.append("contactName", contactName.trim());
      formData.append("phone", phone.replace(/\s/g, ""));
      formData.append("email", email.trim());
      formData.append("requestedAmount", String(requestedAmount));
      formData.append("purpose", purpose.trim());
      formData.append("termMonths", String(termMonths));
      formData.append("notes", notes.trim());
      formData.append("crNumber", crNumber.trim());
      formData.append("detailedActivity", detailedActivity.trim());
      formData.append("establishmentDate", establishmentDate);
      formData.append("companyAgeYears", String(companyAgeYears));
      formData.append("ownerName", ownerName.trim());
      formData.append("ownerNationalId", ownerNationalId.trim());
      Object.entries(documents).forEach(([key, file]) => file && formData.append(key, file));

      const response = await fetch("/api/financing-requests", { method: "POST", body: formData });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "تعذر إرسال الطلب");
      setConfirmation({
        id: json.id,
        ticketNumber: json.ticketNumber || json.id,
        inquiryNumber: json.inquiryNumber || json.id,
        otpSentToEmail: Boolean(json.otpSentToEmail),
        bankQuote: json.bankQuote,
        lifecycle: json.lifecycle,
      });
    } catch (reason) {
      setSubmitError(reason instanceof Error ? reason.message : "تعذر إرسال الطلب");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownloadPdf() {
    if (!summaryRef.current || !confirmation) return;
    await exportElementToPdf(summaryRef.current, `financial-pulse-${confirmation.ticketNumber}.pdf`);
  }

  if (error) return <MessagePage tone="error" message={error} />;
  if (!report || !applicant || !quote) return <div className="portal-loading-shell"><Loader2 className="h-8 w-8 animate-spin text-[#0B1F3A]" /></div>;

  if (confirmation) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] px-4 py-12" dir="rtl">
        <div className="mx-auto max-w-6xl space-y-7">
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
            <h1 className="mt-4 text-3xl font-bold">تم إرسال طلب التمويل بنجاح</h1>
            <p className="mt-2 text-sm text-slate-500">يُحتفظ برقم المعاملة لمتابعة الموافقة المشروطة والضمانات والصرف.</p>
          </div>
          <section ref={summaryRef} className="request-section p-6 md:p-8">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="portal-section-label">رقم المعاملة</p><h2 className="mt-1 text-2xl font-bold tabular-nums text-[#0F172A]">{confirmation.inquiryNumber}</h2></div>
              <div className="rounded-2xl bg-[#F8FAFC] border border-[#D9E2EC] px-4 py-3 text-sm font-bold text-[#0B1F3A]">الحالة: تحت مراجعة البنك</div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <SummaryCard label="الشركة" value={applicant.applicantName} />
              <SummaryCard label="المبلغ المطلوب" value={`${Math.round(requestedAmount).toLocaleString("ar-SA")} ر.س`} />
              <SummaryCard label="المدة" value={`${termMonths} شهر`} />
              <SummaryCard label="جهة التمويل" value={confirmation.bankQuote.bank.name} />
            </div>
          </section>
          {confirmation.lifecycle && <FinancingLifecycleCards lifecycle={confirmation.lifecycle} title="رحلة طلبك من المراجعة حتى المتابعة الشهرية" />}
          <div className="grid gap-3 sm:grid-cols-3">
            <Link href="/inquiry" className="portal-primary-btn h-12 text-sm">الاستعلام عن الطلب</Link>
            <Link href="/" className="portal-secondary-btn h-12 text-sm">العودة للرئيسية</Link>
            <button onClick={handleDownloadPdf} className="portal-secondary-btn h-12 text-sm gap-2"><FileDown className="h-4 w-4" />تحميل الملخص</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="request-flow min-h-screen px-4 py-10" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-7">
        <Link href={`/dashboard/${params.id}`} className="portal-link inline-flex items-center gap-2 text-sm"><ArrowRight className="h-4 w-4" />العودة إلى التقييم المالي</Link>

        <section className="overflow-hidden rounded-2xl bg-[#0B1F3A] p-6 text-white md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="portal-section-label text-[#D88945]">الخطوة التالية بعد التقييم المالي</p>
              <h1 className="mt-2 text-3xl font-bold">استكمال بيانات الشركة وطلب التمويل</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">يُرفق السجل التجاري وهوية المفوض وكشف الحساب قبل إرسال الطلب. مستندات الضمان لا تُطلب في هذه المرحلة؛ وتظهر فقط عند الموافقة المبدئية أو المشروطة.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <HeroMetric label="التمويل المقترح" value={`${Math.round(getDefaultAmount(report)).toLocaleString("ar-SA")} ر.س`} />
              <HeroMetric label="الجهة المقترحة" value={quote.bank.name} />
            </div>
          </div>
        </section>

        <JourneyHeader />


        <section className="request-section p-6 md:p-8">
          <SectionTitle icon={Building2} title="1. بيانات المنشأة والسجل التجاري" description="تظهر هذه البيانات لموظف البنك داخل الملف الائتماني نفسه." />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="رقم السجل التجاري *"><input className="fp-input" value={crNumber} inputMode="numeric" onChange={(event) => setCrNumber(event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10 أرقام" /></Field>
            <Field label="تاريخ تأسيس الشركة *"><input className="fp-input" type="date" max={new Date().toISOString().slice(0, 10)} value={establishmentDate} onChange={(event) => updateEstablishmentDate(event.target.value)} /></Field>
            <Field label="اسم مالك الشركة أو المفوض بالتوقيع *"><input className="fp-input" value={ownerName} onChange={(event) => setOwnerName(event.target.value)} /></Field>
            <Field label="رقم الهوية *"><input className="fp-input" value={ownerNationalId} inputMode="numeric" onChange={(event) => setOwnerNationalId(event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10 أرقام" /></Field>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
            <Field label="النشاط التفصيلي *">
              <textarea
                className="fp-input min-h-24"
                value={detailedActivity}
                onChange={(event) => setDetailedActivity(event.target.value)}
                placeholder="يُذكر النشاط الفعلي والمنتجات أو الخدمات الرئيسية"
              />
              <p className="mt-2 text-xs leading-6 text-slate-500">
                يوضح النشاط الفعلي للمنشأة والمنتجات أو الخدمات الرئيسية، ويُستخدم لفهم طبيعة التشغيل ومصدر الإيراد.
              </p>
            </Field>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:min-w-[210px]">
              <p className="text-xs font-semibold text-slate-600">العمر المحسوب تلقائيًا</p>
              <p className="mt-2 text-xl font-bold tabular-nums">{companyAgeYears === 0 && establishmentDate ? "أقل من سنة" : `${companyAgeYears} سنة`}</p>
              <p className="mt-2 text-xs leading-6 text-slate-500">
                يُحتسب من تاريخ التأسيس حتى تاريخ اليوم، ويُستخدم كمؤشر وصفي على مدة ممارسة النشاط.
              </p>
            </div>
          </div>
        </section>

        <section className="request-section p-6 md:p-8">
          <SectionTitle icon={FileCheck2} title="2. المستندات المطلوبة" description="قائمة بسيطة وواضحة؛ مستندات الضمان تظهر لاحقاً فقط إذا قرر البنك أنها مطلوبة." />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {visibleDocuments.map((definition) => (
              <DocumentUploadCard
                key={definition.key}
                definition={definition}
                file={definition.completedByReport ? null : documents[definition.key as DocumentKey] || null}
                onChange={(file) => !definition.completedByReport && setDocument(definition.key as DocumentKey, file)}
              />
            ))}
          </div>
        </section>

        <section className="request-section p-6 md:p-8">
          <SectionTitle
            icon={CircleDollarSign}
            title="3. تفاصيل طلب التمويل"
            description="سيستخدم البنك هذه البيانات مع التقييم المالي والمستندات لاتخاذ القرار."
            badge={<div className="shrink-0 rounded-xl bg-[#F8FAFC] border border-[#D9E2EC] px-3 py-1.5 text-left"><p className="text-[10px] text-[#64748B]">النسبة التقديرية</p><p className="text-sm font-bold tabular-nums text-[#C9793B]">{quote.estimatedRate.toFixed(2)}%</p></div>}
          />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="اسم مسؤول التواصل *"><input className="fp-input" value={contactName} onChange={(event) => setContactName(event.target.value)} /></Field>
            <Field label="رقم الجوال *"><input className="fp-input" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="05xxxxxxxx" /></Field>
            <Field label="البريد الإلكتروني"><input className="fp-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
            <Field label="المبلغ المطلوب (ريال) *"><input className="fp-input tabular-nums" type="number" min="1" value={requestedAmount || ""} onChange={(event) => setRequestedAmount(Number(event.target.value))} /></Field>
            <Field label="مدة السداد"><select className="fp-input bg-white" value={termMonths} onChange={(event) => setTermMonths(Number(event.target.value))}>{TERM_OPTIONS.map((term) => <option key={term} value={term}>{term} شهر</option>)}</select></Field>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="الغرض من التمويل"><textarea className="fp-input min-h-24" value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="مثال: شراء معدات أو تمويل رأس المال العامل" /></Field>
            <Field label="ملاحظات إضافية (اختياري)"><textarea className="fp-input min-h-24" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
          </div>
          {submitError && <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700">{submitError}</div>}
          <button onClick={handleSubmit} disabled={submitting} className="portal-primary-btn mt-6 h-14 w-full text-sm disabled:opacity-50">{submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Landmark className="h-5 w-5" />}{submitting ? "جاري إرسال الطلب..." : "إرسال طلب التمويل إلى البنك"}</button>
        </section>
      </div>
    </main>
  );
}

function JourneyHeader() {
  const steps = [
    ["1", "التقييم المالي", "مكتمل"],
    ["2", "بيانات السجل والمستندات", "الحالية"],
    ["3", "مراجعة البنك", "لاحقاً"],
    ["4", "موافقة مشروطة وضمانات", "عند الحاجة"],
    ["5", "الموافقة النهائية والصرف", "بعد الاستيفاء"],
    ["6", "المتابعة الشهرية", "بعد الصرف"],
  ];
  return <section className="request-journey overflow-x-auto p-5"><div className="flex min-w-[900px] items-center">{steps.map((step, index) => <div key={step[0]} className="flex flex-1 items-center"><div className="text-center"><div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${index === 0 ? "bg-[#1F8A5B] text-white" : index === 1 ? "bg-[#0B1F3A] text-white" : "bg-[#F8FAFC] text-[#64748B] border border-[#D9E2EC]"}`}>{index === 0 ? <Check className="h-4 w-4" /> : step[0]}</div><p className="mt-2 text-xs font-bold text-[#0F172A]">{step[1]}</p><p className="mt-1 text-[10px] text-[#64748B]">{step[2]}</p></div>{index < steps.length - 1 && <div className={`mx-3 h-0.5 flex-1 ${index === 0 ? "bg-[#0B1F3A]" : "bg-[#E8EDF4]"}`} />}</div>)}</div></section>;
}

function DocumentUploadCard({ definition, file, onChange }: { definition: DocumentDefinition; file: File | null; onChange: (file: File | null) => void }) {
  const inputId = `document-${definition.key}`;
  const complete = definition.completedByReport || Boolean(file);
  return (
    <article className={`rounded-2xl border p-4 transition ${complete ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${complete ? "bg-[#ECFDF5] text-[#1F8A5B]" : "bg-[#F8FAFC] text-[#0B1F3A]"}`}>{complete ? <CheckCircle2 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</div>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold">{definition.title}</h3><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${definition.required ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-500"}`}>{definition.required ? "إلزامي" : "اختياري"}</span></div><p className="mt-1 text-xs leading-5 text-slate-500">{definition.description}</p></div>
      </div>
      {definition.completedByReport ? <div className="mt-4 rounded-xl bg-white border border-[#D9E2EC] px-3 py-2 text-xs font-bold text-[#1F8A5B]">مكتمل من ملف التقييم المالي</div> : file ? <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#D9E2EC] bg-white px-3 py-2"><div className="min-w-0"><p className="truncate text-xs font-bold">{file.name}</p><p className="mt-1 text-[10px] text-[#64748B]">{(file.size / 1024 / 1024).toFixed(2)} MB</p></div><button type="button" onClick={() => onChange(null)} className="rounded-lg p-2 text-[#64748B] hover:bg-[#F8FAFC]"><X className="h-4 w-4" /></button></div> : <label htmlFor={inputId} className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#D9E2EC] bg-[#F8FAFC] px-3 py-3 text-xs font-bold text-[#0B1F3A] hover:border-[#0B1F3A]/30"><UploadCloud className="h-4 w-4" />اختيار ملف<input id={inputId} type="file" accept={definition.accept} className="hidden" onChange={(event) => onChange(event.target.files?.[0] || null)} /></label>}
    </article>
  );
}

function SectionTitle({ icon: Icon, title, description, badge }: { icon: typeof Building2; title: string; description: string; badge?: React.ReactNode }) { return <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F8FAFC] text-[#0B1F3A] border border-[#D9E2EC]"><Icon className="h-5 w-5" /></div><div><h2 className="text-lg font-bold text-[#0F172A]">{title}</h2><p className="mt-1 text-xs leading-6 text-[#64748B]">{description}</p></div></div>{badge}</div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-bold text-[#0F172A]">{label}</span>{children}</label>; }
function HeroMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4"><p className="text-[10px] text-slate-400">{label}</p><p className="mt-2 text-sm font-bold">{value}</p></div>; }
function SummaryCard({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-[#F8FAFC] border border-[#D9E2EC] p-4"><p className="text-[10px] text-[#64748B]">{label}</p><p className="mt-2 text-sm font-bold text-[#0F172A]">{value}</p></div>; }
function MessagePage({ message, tone }: { message: string; tone: "error" }) { return <div className="portal-page text-center"><p className={tone === "error" ? "portal-error" : "font-bold"}>{message}</p></div>; }
function getDefaultAmount(report: StoredReport) { return report.type === "company" ? (report.data as CompanyReportData).funding.amount : (report.data as StartupReportData).fundingNeeded; }
function getApplicantInfo(report: StoredReport): { applicantName: string; sector: string; riskLevel: RiskLevel } {
  if (report.type === "company") { const data = report.data as CompanyReportData; return { applicantName: data.companyName, sector: data.sector, riskLevel: data.risk.riskLevel }; }
  const data = report.data as StartupReportData; return { applicantName: data.input.projectName, sector: data.input.sector, riskLevel: data.successProbability >= 65 ? "low" : data.successProbability >= 45 ? "medium" : "high" };
}
