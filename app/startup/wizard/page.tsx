"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import WizardStepper from "@/components/WizardStepper";
import { SECTORS } from "@/lib/financial";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { StartupAnalysisInput } from "@/lib/types";

const STEPS = ["هوية المشروع", "البيانات المالية", "السوق والأهداف"];

const EMPTY: StartupAnalysisInput = {
  projectName: "",
  ideaDescription: "",
  sector: SECTORS[0],
  city: "",
  currentCapital: 0,
  expectedBudget: 0,
  employeeCount: 0,
  goals: "",
  revenueSources: "",
  expenses: "",
  targetAudience: "",
};

export default function StartupWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<StartupAnalysisInput>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof StartupAnalysisInput>(key: K, value: StartupAnalysisInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validateStep(): boolean {
    if (step === 0 && (!form.projectName.trim() || !form.ideaDescription.trim())) {
      setError("يرجى إدخال اسم المشروع ووصف الفكرة");
      return false;
    }
    setError("");
    return true;
  }

  async function handleSubmit() {
    if (!validateStep()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/startups/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "حدث خطأ");
      router.push(`/dashboard/${json.id}`);
    } catch (e: any) {
      setError(e.message || "تعذر إتمام الطلب");
      setLoading(false);
    }
  }

  return (
    <div className="portal-page max-w-2xl">
      <h1 className="font-heading text-2xl font-bold mb-2 text-[#0F172A]">تقييم فكرة مشروع جديد</h1>
      <p className="text-[#475569] mb-8">
        أجب عن الأسئلة التالية لتقييم جدوى مشروعك وفرص التمويل المتاحة.
      </p>

      <WizardStepper steps={STEPS} current={step} />

      <div className="portal-form-card space-y-5 md:p-8">
        {step === 0 && (
          <>
            <Field label="اسم المشروع">
              <input
                value={form.projectName}
                onChange={(e) => update("projectName", e.target.value)}
                className="fp-input"
                placeholder="مثال: منصة توصيل ذكية"
              />
            </Field>
            <Field label="وصف الفكرة">
              <textarea
                value={form.ideaDescription}
                onChange={(e) => update("ideaDescription", e.target.value)}
                className="fp-input min-h-[100px]"
                placeholder="اشرح فكرة المشروع بإيجاز"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="القطاع">
                <select
                  value={form.sector}
                  onChange={(e) => update("sector", e.target.value)}
                  className="fp-input bg-white"
                >
                  {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="المدينة">
                <input
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  className="fp-input"
                  placeholder="مثال: جدة"
                />
              </Field>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="رأس المال الحالي (ريال)">
                <input
                  type="number"
                  value={form.currentCapital || ""}
                  onChange={(e) => update("currentCapital", Number(e.target.value))}
                  className="fp-input"
                />
              </Field>
              <Field label="الميزانية المتوقعة (ريال)">
                <input
                  type="number"
                  value={form.expectedBudget || ""}
                  onChange={(e) => update("expectedBudget", Number(e.target.value))}
                  className="fp-input"
                />
              </Field>
            </div>
            <Field label="عدد الموظفين">
              <input
                type="number"
                value={form.employeeCount || ""}
                onChange={(e) => update("employeeCount", Number(e.target.value))}
                className="fp-input"
              />
            </Field>
            <Field label="مصادر الدخل">
              <textarea
                value={form.revenueSources}
                onChange={(e) => update("revenueSources", e.target.value)}
                className="fp-input"
                placeholder="مثال: اشتراكات شهرية، عمولة على المبيعات"
              />
            </Field>
            <Field label="المصروفات المتوقعة">
              <textarea
                value={form.expenses}
                onChange={(e) => update("expenses", e.target.value)}
                className="fp-input"
                placeholder="مثال: رواتب، تسويق، تشغيل"
              />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <Field label="أهداف المشروع">
              <textarea
                value={form.goals}
                onChange={(e) => update("goals", e.target.value)}
                className="fp-input"
                placeholder="ما الذي تطمح لتحقيقه خلال السنة الأولى؟"
              />
            </Field>
            <Field label="الجمهور المستهدف">
              <textarea
                value={form.targetAudience}
                onChange={(e) => update("targetAudience", e.target.value)}
                className="fp-input"
                placeholder="من هم عملاؤك المستهدفون؟"
              />
            </Field>
          </>
        )}

        {error && <p className="portal-error">{error}</p>}

        <div className="flex justify-between pt-2">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || loading}
            className="portal-secondary-btn px-5 py-2.5 text-sm disabled:opacity-0"
          >
            <ArrowRight className="w-4 h-4" />
            السابق
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => validateStep() && setStep((s) => s + 1)}
              className="portal-primary-btn px-6 py-2.5 text-sm"
            >
              التالي
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="portal-primary-btn px-6 py-2.5 text-sm disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "جاري المعالجة..." : "إنهاء وتقييم فرصة التمويل"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5 text-[#0F172A]">{label}</label>
      {children}
    </div>
  );
}
