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
      setError(e.message || "تعذر إتمام التحليل");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="font-heading text-2xl font-bold mb-2">تقييم فكرة مشروع جديد</h1>
      <p className="text-fp-slate mb-8">
        أجب عن الأسئلة التالية ليقوم الذكاء الاصطناعي بتقييم جدوى مشروعك
      </p>

      <WizardStepper steps={STEPS} current={step} />

      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-card border border-black/5 space-y-5">
        {step === 0 && (
          <>
            <Field label="اسم المشروع">
              <input
                value={form.projectName}
                onChange={(e) => update("projectName", e.target.value)}
                className="input"
                placeholder="مثال: منصة توصيل ذكية"
              />
            </Field>
            <Field label="وصف الفكرة">
              <textarea
                value={form.ideaDescription}
                onChange={(e) => update("ideaDescription", e.target.value)}
                className="input min-h-[100px]"
                placeholder="اشرح فكرة المشروع بإيجاز"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="القطاع">
                <select
                  value={form.sector}
                  onChange={(e) => update("sector", e.target.value)}
                  className="input bg-white"
                >
                  {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="المدينة">
                <input
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  className="input"
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
                  className="input"
                />
              </Field>
              <Field label="الميزانية المتوقعة (ريال)">
                <input
                  type="number"
                  value={form.expectedBudget || ""}
                  onChange={(e) => update("expectedBudget", Number(e.target.value))}
                  className="input"
                />
              </Field>
            </div>
            <Field label="عدد الموظفين">
              <input
                type="number"
                value={form.employeeCount || ""}
                onChange={(e) => update("employeeCount", Number(e.target.value))}
                className="input"
              />
            </Field>
            <Field label="مصادر الدخل">
              <textarea
                value={form.revenueSources}
                onChange={(e) => update("revenueSources", e.target.value)}
                className="input"
                placeholder="مثال: اشتراكات شهرية، عمولة على المبيعات"
              />
            </Field>
            <Field label="المصروفات المتوقعة">
              <textarea
                value={form.expenses}
                onChange={(e) => update("expenses", e.target.value)}
                className="input"
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
                className="input"
                placeholder="ما الذي تطمح لتحقيقه خلال السنة الأولى؟"
              />
            </Field>
            <Field label="الجمهور المستهدف">
              <textarea
                value={form.targetAudience}
                onChange={(e) => update("targetAudience", e.target.value)}
                className="input"
                placeholder="من هم عملاؤك المستهدفون؟"
              />
            </Field>
          </>
        )}

        {error && <p className="text-sm text-risk-high">{error}</p>}

        <div className="flex justify-between pt-2">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || loading}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-medium text-fp-slate hover:bg-black/5 disabled:opacity-0 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            السابق
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => validateStep() && setStep((s) => s + 1)}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-full bg-green-gradient text-white text-sm font-semibold shadow-card hover:opacity-90 transition-opacity"
            >
              التالي
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-green-gradient text-white text-sm font-semibold shadow-card hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "جاري التحليل..." : "إنهاء وتحليل المشروع"}
            </button>
          )}
        </div>
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
