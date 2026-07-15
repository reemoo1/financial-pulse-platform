"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CalendarCheck,
  CalendarClock,
  CircleDollarSign,
  FileClock,
  FileUp,
  Gavel,
  LineChart,
  Loader2,
  ReceiptText,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  UploadCloud,
  WalletCards,
} from "lucide-react";
import {
  BankCreditReview,
  CollectionEvent,
  FinancingDisbursementRecord,
  FinancingInstallment,
  FinancingMonitoring,
  FinancingOperations,
  FinancingRequestStatus,
  MonitoringAction,
  MonitoringSnapshot,
  RestructuringPlan,
} from "@/lib/types";
import { date, money } from "./BankUI";

type Props = {
  requestId: string;
  status: FinancingRequestStatus;
  review?: BankCreditReview;
  collateralReady: boolean;
  operations?: FinancingOperations;
  monitoring?: FinancingMonitoring;
};

type Feedback = { tone: "ok" | "error"; text: string };

const today = () => new Date().toISOString().slice(0, 10);
const currentPeriod = () => new Date().toISOString().slice(0, 7);

export default function FinancingOperationsPanel({
  requestId,
  status,
  review,
  collateralReady,
  operations,
  monitoring,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const approvedAmount = Number(review?.approvedAmount || 0);
  const totalDisbursed = Number(operations?.totalDisbursed || 0);
  const remaining = Number(operations?.remainingUndisbursed ?? approvedAmount);
  const installments = operations?.installments || [];
  const nextInstallment = installments.find((item) => item.status !== "paid" && item.status !== "waived");
  const latestSnapshot = monitoring?.snapshots?.at(-1);

  const alerts = useMemo(() => {
    const values: string[] = [];
    const lateInstallments = installments.filter((item) => item.status === "late" || item.daysPastDue > 0);
    if (lateInstallments.length) values.push(`يوجد ${lateInstallments.length} قسط متأخر يحتاج إجراء متابعة موثق.`);
    if (monitoring?.nextSubmissionDate && new Date(monitoring.nextSubmissionDate).getTime() < Date.now()) {
      values.push("تجاوزت الشركة موعد رفع القوائم أو كشف الحساب الدوري.");
    }
    if (latestSnapshot?.status === "watch") values.push("آخر تحديث مالي مصنف تحت المراقبة؛ راجعي التنبيهات وخطة الإجراء.");
    if (latestSnapshot?.status === "high_risk") values.push("آخر تحديث مالي عالي المخاطر ويحتاج تصعيدًا فوريًا.");
    if (status === "defaulted") values.push("التمويل مصنف متعثرًا؛ تابعي التحصيل والاسترداد من الضمان وفق الإجراءات المعتمدة.");
    return values;
  }, [installments, latestSnapshot?.status, monitoring?.nextSubmissionDate, status]);

  async function submit(action: string, payload: Record<string, unknown> = {}, formData?: FormData) {
    setBusy(action);
    setFeedback(null);
    try {
      const response = await fetch(`/api/bank/requests/${requestId}/operations`, {
        method: "POST",
        ...(formData
          ? { body: formData }
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action, ...payload }),
            }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "تعذر حفظ العملية.");
      setFeedback({ tone: "ok", text: "تم حفظ العملية وتحديث ملف التمويل بنجاح." });
      router.refresh();
    } catch (error) {
      setFeedback({ tone: "error", text: error instanceof Error ? error.message : "تعذر حفظ العملية." });
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="space-y-6" id="financing-operations">
      {feedback ? (
        <div
          className={`rounded-2xl border p-4 text-sm font-semibold ${
            feedback.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      <DisbursementSection
        approvedAmount={approvedAmount}
        remaining={remaining}
        totalDisbursed={totalDisbursed}
        collateralReady={collateralReady}
        status={status}
        records={operations?.disbursements || []}
        busy={busy === "record_disbursement"}
        onSubmit={(payload) => submit("record_disbursement", payload)}
      />

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="bank-icon-box h-12 w-12">
              <FileClock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#C9793B]">بعد تسجيل الصرف</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">المتابعة المالية الدورية والإنذار المبكر</h2>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
            <span className="text-slate-500">دورية المتابعة: </span>
            <strong>{monitoring?.cadence === "quarterly" ? "ربع سنوية" : "شهرية"}</strong>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          <MonitoringSection
            monitoring={monitoring}
            nextInstallment={nextInstallment}
            busy={busy}
            onSubmit={submit}
          />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-rose-700">عند وجود تأخر أو تدهور</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">العلاج والتحصيل وإعادة الجدولة</h2>
            <p className="mt-1 text-xs leading-6 text-slate-500">
              الضمان خط حماية ثانٍ وليس بديلًا عن قدرة الشركة على السداد. يبدأ التنفيذ فقط بعد توثيق التعثر والإجراءات النظامية.
            </p>
          </div>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <CollectionSection
            events={operations?.collectionEvents || []}
            busy={busy === "collection_event"}
            onSubmit={(payload) => submit("collection_event", payload)}
          />
          <RestructureSection
            plans={operations?.restructuringPlans || []}
            balance={Math.max(0, totalDisbursed - Number(operations?.totalRecovered || 0))}
            review={review}
            busy={busy === "restructure"}
            onSubmit={(payload) => submit("restructure", payload)}
          />
        </div>
      </section>
    </section>
  );
}

function DisbursementSection({
  approvedAmount,
  remaining,
  totalDisbursed,
  collateralReady,
  status,
  records,
  busy,
  onSubmit,
}: {
  approvedAmount: number;
  remaining: number;
  totalDisbursed: number;
  collateralReady: boolean;
  status: FinancingRequestStatus;
  records: FinancingDisbursementRecord[];
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const enabled = isApproved(status) && collateralReady && remaining > 0;
  const [form, setForm] = useState({
    amount: remaining,
    mode: "full",
    beneficiaryName: "",
    beneficiaryIban: "",
    beneficiaryBank: "",
    transferReference: "",
    disbursementDate: today(),
    note: "",
  });

  const progress = approvedAmount > 0 ? Math.min(100, (totalDisbursed / approvedAmount) * 100) : 0;

  function send() {
    onSubmit(form);
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionTitle
          icon={Banknote}
          eyebrow="الخطوة الأولى بعد التفعيل"
          title="تسجيل الصرف الفعلي"
          subtitle="يسجل موظف العمليات التحويل الحقيقي، ثم ينشئ النظام جدول الأقساط بناءً على المبلغ المصروف وشروط الموافقة."
        />
        <div className="grid grid-cols-3 gap-2 text-center text-[10px] sm:min-w-[360px]">
          <MiniKpi label="المعتمد" value={money(approvedAmount)} />
          <MiniKpi label="المصروف" value={money(totalDisbursed)} />
          <MiniKpi label="المتبقي" value={money(remaining)} />
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-[#0B1F3A] transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-2 text-[10px] text-slate-500">تم صرف {progress.toLocaleString("ar-SA", { maximumFractionDigits: 1 })}% من مبلغ الموافقة.</p>

      {!enabled ? (
        <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <strong className="block">بوابة الصرف مقفلة حاليًا</strong>
            يلزم وجود موافقة نهائية، واكتمال توثيق وتفعيل الضمانات المطلوبة، ووجود مبلغ متبقٍ للصرف.
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="المبلغ المصروف">
              <input
                className="bank-input mt-1.5 w-full"
                type="number"
                min={0}
                max={remaining}
                value={form.amount}
                onChange={(event) => setForm((old) => ({ ...old, amount: Number(event.target.value) }))}
              />
            </Field>
            <Field label="نوع الصرف">
              <select
                className="bank-input mt-1.5 w-full bg-white"
                value={form.mode}
                onChange={(event) => setForm((old) => ({ ...old, mode: event.target.value }))}
              >
                <option value="full">دفعة كاملة</option>
                <option value="tranche">دفعة جزئية / شريحة</option>
              </select>
            </Field>
            <TextInput label="تاريخ الصرف" type="date" value={form.disbursementDate} onChange={(value) => setForm((old) => ({ ...old, disbursementDate: value }))} />
            <TextInput label="اسم المستفيد" value={form.beneficiaryName} onChange={(value) => setForm((old) => ({ ...old, beneficiaryName: value }))} />
            <TextInput label="آيبان المستفيد" value={form.beneficiaryIban} onChange={(value) => setForm((old) => ({ ...old, beneficiaryIban: value }))} />
            <TextInput label="بنك المستفيد" value={form.beneficiaryBank} onChange={(value) => setForm((old) => ({ ...old, beneficiaryBank: value }))} />
            <div className="sm:col-span-2 lg:col-span-3">
              <TextInput label="مرجع التحويل البنكي" value={form.transferReference} onChange={(value) => setForm((old) => ({ ...old, transferReference: value }))} />
            </div>
          </div>
          <Field label="ملاحظات الصرف">
            <textarea
              className="bank-input mt-1.5 min-h-20 w-full resize-y"
              value={form.note}
              onChange={(event) => setForm((old) => ({ ...old, note: event.target.value }))}
              placeholder="مثال: صُرفت الدفعة لشراء خط الإنتاج وفق الفاتورة المعتمدة."
            />
          </Field>
          <PrimaryButton
            busy={busy}
            disabled={
              !enabled ||
              form.amount <= 0 ||
              form.amount > remaining ||
              !form.beneficiaryName.trim() ||
              !form.beneficiaryIban.trim() ||
              !form.transferReference.trim()
            }
            onClick={send}
            icon={ShieldCheck}
          >
            تأكيد وتسجيل الصرف
          </PrimaryButton>
        </div>

        <div>
          <h3 className="text-sm font-bold text-slate-900">سجل عمليات الصرف</h3>
          {records.length ? (
            <div className="mt-3 max-h-[430px] space-y-3 overflow-y-auto pl-1">
              {records
                .slice()
                .reverse()
                .map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-950">{money(item.amount)}</p>
                        <p className="mt-1 text-[10px] text-slate-500">{item.mode === "tranche" ? "شريحة تمويل" : "دفعة كاملة"}</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700">تم الصرف</span>
                    </div>
                    <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                      <p>{item.beneficiaryName}</p>
                      <p>المرجع: {item.transferReference}</p>
                      <p>التاريخ: {date(item.disbursementDate)}</p>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <EmptyState icon={WalletCards} text="لا توجد عملية صرف مسجلة حتى الآن." />
          )}
        </div>
      </div>
    </section>
  );
}

function InstallmentsSection({
  installments,
  busy,
  onSubmit,
}: {
  installments: FinancingInstallment[];
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const unpaid = installments.filter((item) => item.status !== "paid" && item.status !== "waived");
  const firstUnpaid = unpaid[0];
  const [installmentId, setInstallmentId] = useState(firstUnpaid?.id || "");
  const selected = installments.find((item) => item.id === installmentId) || firstUnpaid;
  const [paidAmount, setPaidAmount] = useState(selected?.amountDue || 0);
  const [paidAt, setPaidAt] = useState(today());
  const [daysPastDue, setDaysPastDue] = useState(selected?.daysPastDue || 0);

  const dueTotal = installments.reduce((sum, item) => sum + item.amountDue, 0);
  const paidTotal = installments.reduce((sum, item) => sum + item.paidAmount, 0);
  const lateCount = installments.filter((item) => item.status === "late" || item.daysPastDue > 0).length;

  function choose(id: string) {
    setInstallmentId(id);
    const item = installments.find((entry) => entry.id === id);
    setPaidAmount(Math.max(0, Number(item?.amountDue || 0) - Number(item?.paidAmount || 0)));
    setDaysPastDue(item?.daysPastDue || 0);
  }

  return (
    <div className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionTitle
          icon={ReceiptText}
          eyebrow="السداد"
          title="جدول الأقساط"
          subtitle="يعرض أصل القسط وربحه وحالة السداد وأيام التأخير، مع تسجيل كل دفعة على القسط الصحيح."
        />
        <div className="grid grid-cols-3 gap-2 text-center text-[10px] lg:min-w-[330px]">
          <MiniKpi label="إجمالي الجدول" value={money(dueTotal)} />
          <MiniKpi label="المسدد" value={money(paidTotal)} />
          <MiniKpi label="متأخر" value={`${lateCount.toLocaleString("ar-SA")} قسط`} danger={lateCount > 0} />
        </div>
      </div>

      {installments.length ? (
        <>
          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[760px] text-right text-xs">
              <thead className="bg-slate-50 text-[10px] text-slate-500">
                <tr>
                  <th className="p-3">القسط</th>
                  <th className="p-3">الاستحقاق</th>
                  <th className="p-3">الأصل</th>
                  <th className="p-3">الربح</th>
                  <th className="p-3">الإجمالي</th>
                  <th className="p-3">المدفوع</th>
                  <th className="p-3">التأخير</th>
                  <th className="p-3">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {installments.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="p-3 font-bold">{item.sequence}</td>
                    <td className="p-3">{dateOnly(item.dueDate)}</td>
                    <td className="p-3">{money(item.principal)}</td>
                    <td className="p-3">{money(item.profit)}</td>
                    <td className="p-3 font-bold">{money(item.amountDue)}</td>
                    <td className="p-3">{money(item.paidAmount)}</td>
                    <td className="p-3">{item.daysPastDue ? `${item.daysPastDue} يوم` : "—"}</td>
                    <td className="p-3"><InstallmentBadge status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 rounded-2xl border border-[#D9E2EC] bg-[#F8FAFC] p-4">
            <h3 className="text-sm font-bold text-slate-900">تسجيل دفعة سداد</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="القسط">
                <select className="bank-input mt-1.5 w-full bg-white" value={installmentId} onChange={(event) => choose(event.target.value)}>
                  <option value="">اختاري القسط</option>
                  {unpaid.map((item) => (
                    <option key={item.id} value={item.id}>القسط {item.sequence} — {dateOnly(item.dueDate)}</option>
                  ))}
                </select>
              </Field>
              <NumberInput label="المبلغ المدفوع" value={paidAmount} onChange={setPaidAmount} />
              <TextInput label="تاريخ السداد" type="date" value={paidAt} onChange={setPaidAt} />
              <NumberInput label="أيام التأخير" value={daysPastDue} onChange={setDaysPastDue} />
            </div>
            <PrimaryButton
              busy={busy}
              disabled={!installmentId || paidAmount <= 0}
              onClick={() => onSubmit({ installmentId, paidAmount, paidAt, daysPastDue })}
              icon={CircleDollarSign}
            >
              تسجيل السداد وتحديث حالة القسط
            </PrimaryButton>
          </div>
        </>
      ) : (
        <EmptyState icon={ReceiptText} text="يُنشئ النظام جدول الأقساط تلقائيًا بعد أول عملية صرف مسجلة." />
      )}
    </div>
  );
}

function MonitoringSection({
  monitoring,
  nextInstallment,
  busy,
  onSubmit,
}: {
  monitoring?: FinancingMonitoring;
  nextInstallment?: FinancingInstallment;
  busy: string;
  onSubmit: (action: string, payload?: Record<string, unknown>, formData?: FormData) => void;
}) {
  const [showForm, setShowForm] = useState(true);
  const latest = monitoring?.snapshots.at(-1);

  return (
    <div className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionTitle
          icon={LineChart}
          eyebrow="الرقابة الشهرية"
          title="المتابعة المالية والإنذار المبكر"
          subtitle="ارفع القوائم الشهرية أو كشف الحساب، وسجل المؤشرات الفعلية ليحسب النظام DSCR والسيولة والتغيرات والتنبيهات."
        />
        <div className="flex flex-wrap gap-2">
          {latest ? <MonitoringBadge status={latest.status} /> : <span className="rounded-full border border-slate-200 px-3 py-1.5 text-[10px] font-bold text-slate-500">لا يوجد تحديث بعد</span>}
          <button
            type="button"
            onClick={() => setShowForm((value) => !value)}
            className="rounded-xl border border-[#D9E2EC] bg-[#F8FAFC] px-4 py-2 text-xs font-bold text-[#0B1F3A]"
          >
            {showForm ? "إخفاء نموذج التحديث" : "إضافة تحديث شهري"}
          </button>
        </div>
      </div>

      {latest ? <LatestSnapshotSummary snapshot={latest} /> : null}

      {showForm ? (
        <MonitoringSnapshotForm
          installment={nextInstallment}
          busy={busy === "monitoring_snapshot"}
          onSubmit={(formData) => onSubmit("monitoring_snapshot", {}, formData)}
        />
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <SnapshotHistory snapshots={monitoring?.snapshots || []} />
        <MonitoringActions
          actions={monitoring?.actions || []}
          busy={busy === "add_monitoring_action"}
          onSubmit={(payload) => onSubmit("add_monitoring_action", payload)}
        />
      </div>
    </div>
  );
}

function MonitoringSnapshotForm({
  installment,
  busy,
  onSubmit,
}: {
  installment?: FinancingInstallment;
  busy: boolean;
  onSubmit: (formData: FormData) => void;
}) {
  const [form, setForm] = useState({
    period: currentPeriod(),
    revenue: 0,
    operatingCashFlow: 0,
    maintenanceCapex: 0,
    totalDebt: 0,
    totalAssets: 0,
    currentAssets: 0,
    currentLiabilities: 0,
    scheduledPrincipal: 0,
    scheduledInterest: 0,
    mandatoryDebtFees: 0,
    financeLeasePayments: 0,
    installmentDue: installment?.amountDue || 0,
    installmentPaid: installment?.paidAmount || 0,
    daysPastDue: installment?.daysPastDue || 0,
    unlikelyToPay: false,
    bankruptcy: false,
    enforcementStarted: false,
    distressedRestructuring: false,
    covenantBreach: false,
    ratingDowngrade: false,
    collateralDeterioration: false,
    notes: "",
  });
  const [file, setFile] = useState<File | null>(null);

  function updateNumber(key: keyof typeof form, value: number) {
    setForm((old) => ({ ...old, [key]: value }));
  }

  function submitForm(event: FormEvent) {
    event.preventDefault();
    const data = new FormData();
    data.append("action", "monitoring_snapshot");
    Object.entries(form).forEach(([key, value]) => data.append(key, String(value)));
    if (file) data.append("statementFile", file);
    onSubmit(data);
  }

  return (
    <form onSubmit={submitForm} className="mt-5 rounded-2xl border border-[#D9E2EC] bg-[#F8FAFC] p-4 sm:p-5">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <CalendarCheck className="h-5 w-5 text-[#0B1F3A]" />
        تحديث مالي جديد
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextInput label="الفترة" type="month" value={form.period} onChange={(value) => setForm((old) => ({ ...old, period: value }))} />
        <NumberInput label="الإيرادات" value={form.revenue} onChange={(value) => updateNumber("revenue", value)} />
        <NumberInput label="التدفق النقدي التشغيلي" value={form.operatingCashFlow} onChange={(value) => updateNumber("operatingCashFlow", value)} />
        <NumberInput label="مصروفات الصيانة" value={form.maintenanceCapex} onChange={(value) => updateNumber("maintenanceCapex", value)} />
        <NumberInput label="إجمالي الدين" value={form.totalDebt} onChange={(value) => updateNumber("totalDebt", value)} />
        <NumberInput label="إجمالي الأصول" value={form.totalAssets} onChange={(value) => updateNumber("totalAssets", value)} />
        <NumberInput label="الأصول المتداولة" value={form.currentAssets} onChange={(value) => updateNumber("currentAssets", value)} />
        <NumberInput label="الالتزامات المتداولة" value={form.currentLiabilities} onChange={(value) => updateNumber("currentLiabilities", value)} />
        <NumberInput label="أصل الدين المستحق" value={form.scheduledPrincipal} onChange={(value) => updateNumber("scheduledPrincipal", value)} />
        <NumberInput label="الفوائد / الأرباح المستحقة" value={form.scheduledInterest} onChange={(value) => updateNumber("scheduledInterest", value)} />
        <NumberInput label="رسوم الدين" value={form.mandatoryDebtFees} onChange={(value) => updateNumber("mandatoryDebtFees", value)} />
        <NumberInput label="إيجارات تمويلية" value={form.financeLeasePayments} onChange={(value) => updateNumber("financeLeasePayments", value)} />
        <NumberInput label="القسط المستحق" value={form.installmentDue} onChange={(value) => updateNumber("installmentDue", value)} />
        <NumberInput label="القسط المدفوع" value={form.installmentPaid} onChange={(value) => updateNumber("installmentPaid", value)} />
        <NumberInput label="أيام التأخير" value={form.daysPastDue} onChange={(value) => updateNumber("daysPastDue", value)} />
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-bold text-slate-900">مؤشرات نوعية للتعثر أو التدهور</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Check label="احتمال عدم القدرة على السداد" checked={form.unlikelyToPay} onChange={(value) => setForm((old) => ({ ...old, unlikelyToPay: value }))} />
          <Check label="إفلاس أو توقف جوهري" checked={form.bankruptcy} onChange={(value) => setForm((old) => ({ ...old, bankruptcy: value }))} />
          <Check label="بدء إجراء تنفيذي" checked={form.enforcementStarted} onChange={(value) => setForm((old) => ({ ...old, enforcementStarted: value }))} />
          <Check label="إعادة جدولة بسبب ضائقة" checked={form.distressedRestructuring} onChange={(value) => setForm((old) => ({ ...old, distressedRestructuring: value }))} />
          <Check label="خرق شرط ائتماني" checked={form.covenantBreach} onChange={(value) => setForm((old) => ({ ...old, covenantBreach: value }))} />
          <Check label="انخفاض التصنيف الائتماني" checked={form.ratingDowngrade} onChange={(value) => setForm((old) => ({ ...old, ratingDowngrade: value }))} />
          <Check label="تدهور قيمة الضمان" checked={form.collateralDeterioration} onChange={(value) => setForm((old) => ({ ...old, collateralDeterioration: value }))} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
        <Field label="القوائم الشهرية أو كشف الحساب">
          <label className="mt-1.5 flex min-h-20 cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-[#D9E2EC] bg-white px-4 text-xs font-bold text-[#0B1F3A]">
            <UploadCloud className="h-5 w-5" />
            <span>{file?.name || "اختيار ملف PDF أو Excel"}</span>
            <input className="hidden" type="file" accept=".pdf,.xlsx,.xls,.csv" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </label>
        </Field>
        <Field label="ملاحظات المتابعة">
          <textarea
            className="bank-input mt-1.5 min-h-20 w-full resize-y bg-white"
            value={form.notes}
            onChange={(event) => setForm((old) => ({ ...old, notes: event.target.value }))}
            placeholder="فسري أي تغير جوهري أو استثناء في بيانات هذا الشهر."
          />
        </Field>
      </div>

      <PrimaryButton busy={busy} disabled={!form.period} type="submit" icon={LineChart}>
        تحليل التحديث وحفظ الإنذار المبكر
      </PrimaryButton>
    </form>
  );
}

function LatestSnapshotSummary({ snapshot }: { snapshot: MonitoringSnapshot }) {
  const values = [
    { label: "DSCR", value: Number.isFinite(snapshot.dscr) ? snapshot.dscr.toFixed(2) : "—" },
    { label: "نسبة السيولة", value: Number.isFinite(snapshot.currentRatio) ? snapshot.currentRatio.toFixed(2) : "—" },
    { label: "نسبة الدين", value: `${(snapshot.debtRatio * 100).toLocaleString("ar-SA", { maximumFractionDigits: 1 })}%` },
    { label: "درجة الإنذار", value: `${snapshot.earlyWarningScore.toLocaleString("ar-SA", { maximumFractionDigits: 0 })}%` },
    { label: "احتمال التعثر", value: `${(snapshot.probabilityOfDefault * 100).toLocaleString("ar-SA", { maximumFractionDigits: 1 })}%` },
  ];
  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold text-slate-500">آخر تحديث: {snapshot.period}</p>
          <div className="mt-1 flex items-center gap-2"><MonitoringBadge status={snapshot.status} /><span className="text-[10px] text-slate-500">المرحلة الائتمانية: {stageLabel(snapshot.creditStage)}</span></div>
        </div>
        <span className="text-[10px] text-slate-500">تم الاستلام {date(snapshot.submittedAt)}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {values.map((item) => <MiniKpi key={item.label} label={item.label} value={item.value} />)}
      </div>
      {snapshot.alerts.length ? (
        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          {snapshot.alerts.map((alert) => (
            <div key={alert} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">{alert}</div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">لا توجد إشارات إنذار جوهرية في آخر تحديث.</p>
      )}
    </div>
  );
}

function SnapshotHistory({ snapshots }: { snapshots: MonitoringSnapshot[] }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">سجل التحديثات الدورية</h3>
        <span className="text-[10px] text-slate-500">{snapshots.length.toLocaleString("ar-SA")} تحديث</span>
      </div>
      {snapshots.length ? (
        <div className="mt-3 max-h-[460px] space-y-3 overflow-y-auto pl-1">
          {snapshots
            .slice()
            .reverse()
            .map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-950">الفترة {item.period}</p>
                    <p className="mt-1 text-[10px] text-slate-500">DSCR {item.dscr.toFixed(2)} · سيولة {item.currentRatio.toFixed(2)} · تأخير {item.daysPastDue} يوم</p>
                  </div>
                  <MonitoringBadge status={item.status} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
                  <MiniKpi label="الإيرادات" value={money(item.revenue, true)} />
                  <MiniKpi label="CFADS" value={money(item.cfads, true)} />
                  <MiniKpi label="الإنذار" value={`${Math.round(item.earlyWarningScore)}%`} />
                </div>
                {item.sourceFileName ? <p className="mt-3 flex items-center gap-2 text-[10px] text-[#0B1F3A]"><FileUp className="h-3.5 w-3.5" />{item.sourceFileName}</p> : null}
              </div>
            ))}
        </div>
      ) : (
        <EmptyState icon={LineChart} text="لم تُسجل تحديثات مالية دورية حتى الآن." />
      )}
    </div>
  );
}

function MonitoringActions({
  actions,
  busy,
  onSubmit,
}: {
  actions: MonitoringAction[];
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({ title: "طلب القوائم المالية الشهرية", owner: "", dueDate: today(), note: "" });
  return (
    <div>
      <h3 className="text-sm font-bold text-slate-900">طلبات المتابعة وخطة الإجراء</h3>
      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <TextInput label="الإجراء المطلوب" value={form.title} onChange={(value) => setForm((old) => ({ ...old, title: value }))} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextInput label="المسؤول" value={form.owner} onChange={(value) => setForm((old) => ({ ...old, owner: value }))} />
          <TextInput label="الموعد النهائي" type="date" value={form.dueDate} onChange={(value) => setForm((old) => ({ ...old, dueDate: value }))} />
        </div>
        <Field label="تفاصيل الإجراء">
          <textarea className="bank-input mt-1.5 min-h-20 w-full bg-white" value={form.note} onChange={(event) => setForm((old) => ({ ...old, note: event.target.value }))} />
        </Field>
        <PrimaryButton busy={busy} disabled={!form.title.trim()} onClick={() => onSubmit(form)} icon={Send}>تسجيل طلب المتابعة</PrimaryButton>
      </div>

      {actions.length ? (
        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pl-1">
          {actions
            .slice()
            .reverse()
            .map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 p-3 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <strong>{item.title}</strong>
                  <ActionStatus status={item.status} />
                </div>
                <p className="mt-2 text-slate-500">المسؤول: {item.owner}{item.dueDate ? ` · الموعد ${dateOnly(item.dueDate)}` : ""}</p>
                {item.note ? <p className="mt-2 leading-6 text-slate-600">{item.note}</p> : null}
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
}

function CollectionSection({
  events,
  busy,
  onSubmit,
}: {
  events: CollectionEvent[];
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({ type: "payment_reminder", amount: 0, dueDate: today(), note: "" });
  return (
    <div className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <SectionTitle icon={Gavel} eyebrow="التحصيل" title="إجراء تعثر أو استرداد" subtitle="سجل التسلسل من التذكير وحتى التنفيذ على الضمان، مع المبالغ المستردة." />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="الإجراء">
          <select className="bank-input mt-1.5 w-full bg-white" value={form.type} onChange={(event) => setForm((old) => ({ ...old, type: event.target.value }))}>
            {collectionOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <NumberInput label="المبلغ / الاسترداد" value={form.amount} onChange={(value) => setForm((old) => ({ ...old, amount: value }))} />
        <TextInput label="تاريخ الاستحقاق أو الوعد" type="date" value={form.dueDate} onChange={(value) => setForm((old) => ({ ...old, dueDate: value }))} />
      </div>
      <Field label="تفاصيل الإجراء وأساسه">
        <textarea className="bank-input mt-1.5 min-h-24 w-full" value={form.note} onChange={(event) => setForm((old) => ({ ...old, note: event.target.value }))} />
      </Field>
      <PrimaryButton busy={busy} disabled={!form.note.trim()} onClick={() => onSubmit(form)} icon={Gavel}>تسجيل إجراء التعثر والتحصيل</PrimaryButton>

      {events.length ? (
        <div className="mt-5 max-h-72 space-y-2 overflow-y-auto pl-1">
          {events.slice().reverse().map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 p-3 text-xs">
              <div className="flex items-start justify-between gap-3"><strong>{collectionLabel(item.type)}</strong><span className="text-slate-500">{date(item.createdAt)}</span></div>
              <p className="mt-2 leading-6 text-slate-600">{item.note}</p>
              {item.amount ? <p className="mt-2 font-bold text-slate-900">{money(item.amount)}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RestructureSection({
  plans,
  balance,
  review,
  busy,
  onSubmit,
}: {
  plans: RestructuringPlan[];
  balance: number;
  review?: BankCreditReview;
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    newAmount: balance,
    newRate: Number(review?.approvedRate || 0),
    newTermMonths: Number(review?.approvedTermMonths || 12),
    gracePeriodMonths: 0,
    reason: "",
    status: "proposed",
  });
  return (
    <div className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <SectionTitle icon={RefreshCw} eyebrow="العلاج" title="إعادة الجدولة وخطة المعالجة" subtitle="تُستخدم عند وجود صعوبة مؤقتة قابلة للعلاج، ولا تعتمد إلا بعد توثيق السبب والقدرة الجديدة على السداد." />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <NumberInput label="الرصيد المعاد جدولته" value={form.newAmount} onChange={(value) => setForm((old) => ({ ...old, newAmount: value }))} />
        <NumberInput label="النسبة الجديدة %" value={form.newRate} step="0.01" onChange={(value) => setForm((old) => ({ ...old, newRate: value }))} />
        <NumberInput label="المدة الجديدة بالأشهر" value={form.newTermMonths} onChange={(value) => setForm((old) => ({ ...old, newTermMonths: value }))} />
        <NumberInput label="فترة السماح بالأشهر" value={form.gracePeriodMonths} onChange={(value) => setForm((old) => ({ ...old, gracePeriodMonths: value }))} />
        <Field label="حالة الخطة">
          <select className="bank-input mt-1.5 w-full bg-white" value={form.status} onChange={(event) => setForm((old) => ({ ...old, status: event.target.value }))}>
            <option value="proposed">مقترحة للمراجعة</option>
            <option value="approved">معتمدة</option>
          </select>
        </Field>
      </div>
      <Field label="سبب التعثر وخطة العلاج">
        <textarea className="bank-input mt-1.5 min-h-24 w-full" value={form.reason} onChange={(event) => setForm((old) => ({ ...old, reason: event.target.value }))} />
      </Field>
      <PrimaryButton busy={busy} disabled={!form.reason.trim() || form.newAmount <= 0} onClick={() => onSubmit(form)} icon={RefreshCw}>حفظ خطة إعادة الجدولة</PrimaryButton>

      {plans.length ? (
        <div className="mt-5 space-y-2">
          {plans.slice().reverse().map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 p-3 text-xs">
              <div className="flex items-center justify-between gap-3"><strong>{item.status === "approved" ? "خطة معتمدة" : "خطة مقترحة"}</strong><span>{date(item.createdAt)}</span></div>
              <p className="mt-2 font-bold">{money(item.newAmount)} · {item.newRate}% · {item.newTermMonths} شهر</p>
              <p className="mt-2 leading-6 text-slate-600">{item.reason}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SectionTitle({ icon: Icon, eyebrow, title, subtitle }: { icon: typeof Banknote; eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="bank-icon-box h-12 w-12 shrink-0"><Icon className="h-6 w-6" /></div>
      <div>
        <p className="text-[10px] font-bold text-[#C9793B]">{eyebrow}</p>
        <h3 className="mt-1 text-lg font-bold text-slate-950">{title}</h3>
        <p className="mt-1 max-w-2xl text-xs leading-6 text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function MiniKpi({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${danger ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}>
      <p className="text-[9px] text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-xs font-bold ${danger ? "text-rose-700" : "text-slate-950"}`}>{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="bank-label block">{label}{children}</label>;
}

function TextInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <Field label={label}><input className="bank-input mt-1.5 w-full" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></Field>;
}

function NumberInput({ label, value, onChange, step = "1" }: { label: string; value: number; onChange: (value: number) => void; step?: string }) {
  return <Field label={label}><input className="bank-input mt-1.5 w-full" type="number" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></Field>;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-xs font-semibold text-slate-700">
      <input className="h-4 w-4 accent-[#0B1F3A]" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function PrimaryButton({
  children,
  icon: Icon,
  busy,
  disabled,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  icon: typeof ShieldCheck;
  busy: boolean;
  disabled: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      onClick={onClick}
      className="bank-btn-primary mt-4 h-12 w-full text-xs disabled:cursor-not-allowed disabled:opacity-40"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof ReceiptText; text: string }) {
  return (
    <div className="mt-4 flex min-h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
      <Icon className="h-7 w-7 text-slate-400" />
      <p className="mt-3 text-xs leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function InstallmentBadge({ status }: { status: FinancingInstallment["status"] }) {
  const config: Record<FinancingInstallment["status"], [string, string]> = {
    upcoming: ["قادم", "border-slate-200 bg-slate-50 text-slate-600"],
    due: ["مستحق", "border-[#D9E2EC] bg-[#F8FAFC] text-[#0B1F3A]"],
    partial: ["سداد جزئي", "border-amber-200 bg-amber-50 text-amber-700"],
    paid: ["مسدد", "border-emerald-200 bg-emerald-50 text-emerald-700"],
    late: ["متأخر", "border-rose-200 bg-rose-50 text-rose-700"],
    waived: ["معفى", "border-violet-200 bg-violet-50 text-violet-700"],
  };
  const [label, cls] = config[status] || [status || "—", "border-slate-200 bg-slate-50 text-slate-600"];
  return <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold ${cls}`}>{label}</span>;
}

function MonitoringBadge({ status }: { status: MonitoringSnapshot["status"] }) {
  const config: Record<MonitoringSnapshot["status"], [string, string]> = {
    healthy: ["سليم", "border-emerald-200 bg-emerald-50 text-emerald-700"],
    watch: ["تحت المراقبة", "border-amber-200 bg-amber-50 text-amber-700"],
    high_risk: ["مخاطر مرتفعة", "border-rose-200 bg-rose-50 text-rose-700"],
    default: ["متعثر", "border-red-300 bg-red-100 text-red-800"],
  };
  const [label, cls] = config[status] || [status || "—", "border-slate-200 bg-slate-50 text-slate-600"];
  return <span className={`rounded-full border px-3 py-1.5 text-[10px] font-bold ${cls}`}>{label}</span>;
}

function ActionStatus({ status }: { status: MonitoringAction["status"] }) {
  const labels: Record<MonitoringAction["status"], string> = { open: "مفتوح", in_progress: "قيد التنفيذ", completed: "مكتمل", cancelled: "ملغي" };
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold text-slate-600">{labels[status]}</span>;
}

function isApproved(status: FinancingRequestStatus) {
  return ["approved", "disbursed", "monitoring", "warning", "restructured", "defaulted", "closed"].includes(status);
}

function dateOnly(value?: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("ar-SA");
}

function stageLabel(value: MonitoringSnapshot["creditStage"]) {
  return value === "stage1" ? "المرحلة 1" : value === "stage2" ? "المرحلة 2" : "المرحلة 3";
}

function collectionLabel(type: CollectionEvent["type"]) {
  return Object.fromEntries(collectionOptions)[type] || type;
}

const collectionOptions: Array<[CollectionEvent["type"], string]> = [
  ["payment_reminder", "تذكير بالسداد"],
  ["promise_to_pay", "وعد بالسداد"],
  ["collection_referral", "إحالة للتحصيل"],
  ["legal_notice", "إشعار قانوني"],
  ["collateral_enforcement", "تنفيذ الضمان"],
  ["collateral_sale", "بيع الضمان"],
  ["recovery", "تسجيل مبلغ مسترد"],
  ["closure", "إغلاق التمويل"],
];
