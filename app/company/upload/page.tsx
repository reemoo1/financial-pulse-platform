"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FileDropzone from "@/components/FileDropzone";
import {
  SECTORS,
  MANUAL_FIELD_GROUPS,
  FIELD_LABELS_AR,
  FINANCIAL_FIELDS,
  CORE_FINANCIAL_FIELDS,
  FinancialField,
} from "@/lib/financial";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

export default function CompanyUploadPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"upload" | "manual">("upload");
  const [companyName, setCompanyName] = useState("");
  const [sector, setSector] = useState(SECTORS[0]);
  const [city, setCity] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [impactValues, setImpactValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function getMissingManualFields() {
    return CORE_FINANCIAL_FIELDS.filter((field) => !manualValues[field]?.trim());
  }

  async function handleSubmit() {
    if (!companyName.trim()) {
      setError("يرجى إدخال اسم الشركة");
      return;
    }
    if (tab === "upload" && !file) {
      setError("يرجى رفع ملف القوائم المالية أو التبديل إلى الإدخال اليدوي");
      return;
    }
    if (tab === "manual") {
      const missing = getMissingManualFields();
      if (missing.length) {
        setError(
          `الإدخال اليدوي ناقص. الحقول المطلوبة: ${missing
            .slice(0, 6)
            .map((field) => FIELD_LABELS_AR[field])
            .join("، ")}${missing.length > 6 ? "..." : ""}`
        );
        return;
      }
    }

    const employees = Number(impactValues.employeeCount || 0);
    const saudis = Number(impactValues.saudiEmployeeCount || 0);
    if (employees > 0 && saudis > employees) {
      setError("عدد الموظفين السعوديين لا يمكن أن يتجاوز إجمالي الموظفين");
      return;
    }

    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.append("companyName", companyName);
    formData.append("sector", sector);
    formData.append("city", city);
    formData.append("sourceMethod", tab);
    [
      "employeeCount",
      "saudiEmployeeCount",
      "plannedNewJobs",
      "localProcurementPercent",
      "nonOilRevenuePercent",
      "sustainabilityScore",
    ].forEach((key) => {
      if (impactValues[key]?.trim()) formData.append(key, impactValues[key]);
    });

    if (tab === "upload" && file) {
      formData.append("file", file);
    } else {
      FINANCIAL_FIELDS.forEach((field) => {
        formData.append(field, manualValues[field] || "");
      });
    }

    try {
      const res = await fetch("/api/companies/analyze", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        const missing = Array.isArray(json.missingFields) && json.missingFields.length
          ? `\nالحقول الناقصة: ${json.missingFields.join("، ")}`
          : "";
        const details = Array.isArray(json.details) && json.details.length
          ? `\nملاحظات: ${json.details.join("، ")}`
          : "";
        throw new Error(`${json.error || "حدث خطأ"}${missing}${details}`);
      }
      router.push(`/dashboard/${json.id}`);
    } catch (e: any) {
      setError(e.message || "تعذر إتمام الطلب");
      setLoading(false);
    }
  }

  return (
    <div className="portal-page-wide">
      <h1 className="font-heading text-2xl font-bold mb-2 text-[#0F172A]">رفع القوائم المالية</h1>
      <p className="text-[#475569] mb-8">
        يتم تنظيف البيانات ومعالجتها آليًا ثم التحقق من اكتمال القوائم قبل إنشاء لوحة النتائج.
      </p>

      <div className="portal-form-card space-y-6 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">اسم الشركة</label>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="fp-input"
              placeholder="مثال: شركة الأفق للتجارة"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">القطاع</label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="fp-input bg-white"
            >
              {SECTORS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1.5">المدينة</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="fp-input"
              placeholder="مثال: الرياض"
            />
          </div>
        </div>

        <div className="border border-[#D9E2EC] bg-[#F8FAFC] rounded-2xl p-4 md:p-5">
          <div className="mb-4">
            <h2 className="font-semibold">بيانات الأثر الفعلية لرؤية 2030</h2>
            <p className="text-xs text-fp-slate mt-1">
              اختيارية، لكنها تجعل درجات التوطين والمساهمة غير النفطية والاستدامة وخلق الوظائف مبنية على بيانات الشركة بدل التقدير القطاعي.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              ["employeeCount", "إجمالي الموظفين", undefined],
              ["saudiEmployeeCount", "الموظفون السعوديون", undefined],
              ["plannedNewJobs", "وظائف جديدة خلال 12 شهراً", undefined],
              ["localProcurementPercent", "المشتريات المحلية %", 100],
              ["nonOilRevenuePercent", "الإيرادات غير النفطية %", 100],
              ["sustainabilityScore", "درجة الاستدامة الداخلية %", 100],
            ].map(([key, label, max]) => (
              <div key={String(key)}>
                <label className="block text-sm font-medium mb-1.5">{label}</label>
                <input
                  type="number"
                  min="0"
                  max={max as number | undefined}
                  step="1"
                  dir="ltr"
                  value={impactValues[String(key)] || ""}
                  onChange={(e) =>
                    setImpactValues((values) => ({
                      ...values,
                      [String(key)]: e.target.value,
                    }))
                  }
                  className="fp-input text-left bg-white"
                  placeholder="اختياري"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 border-b border-[#E8EDF4]">
          <button
            onClick={() => setTab("upload")}
            className={`portal-tab ${tab === "upload" ? "is-active" : ""}`}
          >
            رفع ملف
          </button>
          <button
            onClick={() => setTab("manual")}
            className={`portal-tab ${tab === "manual" ? "is-active" : ""}`}
          >
            إدخال يدوي كامل
          </button>
        </div>

        {tab === "upload" ? (
          <div className="space-y-3">
            <FileDropzone file={file} onFileSelected={setFile} accept=".xlsx,.xls,.csv,.pdf" />
            <div className="portal-note">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <p>
                يدعم Excel وCSV وPDF النصي. إذا كان الملف ناقصاً أو لا يحتوي على القوائم الثلاث، سيظهر تنبيه بالحقول الناقصة ولن يتم إنشاء تقرير غير دقيق.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="portal-note portal-note-warn">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>
                لضمان دقة الحسابات، لازم تعبئة كل الحقول الأساسية للقوائم المالية الثلاث. يمكن إدخال القيم السالبة للتدفقات الخارجة مثل التدفق الاستثماري.
              </p>
            </div>

            {MANUAL_FIELD_GROUPS.map((group) => (
              <div key={group.title} className="border border-[#D9E2EC] rounded-2xl p-4">
                <div className="mb-4">
                  <h2 className="font-semibold">{group.title}</h2>
                  <p className="text-xs text-fp-slate mt-1">{group.description}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.fields.map((field: FinancialField) => (
                    <div key={field}>
                      <label className="block text-sm font-medium mb-1.5">
                        {FIELD_LABELS_AR[field]} {CORE_FINANCIAL_FIELDS.includes(field as (typeof CORE_FINANCIAL_FIELDS)[number]) ? <span className="text-rose-600">*</span> : <span className="text-[10px] text-[#64748B]">مصرفي</span>}
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        dir="ltr"
                        value={manualValues[field] || ""}
                        onChange={(e) =>
                          setManualValues((v) => ({ ...v, [field]: e.target.value }))
                        }
                        className="fp-input text-left"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="whitespace-pre-line rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="portal-primary-btn w-full disabled:opacity-60"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "جاري تنظيف البيانات والتحقق منها..." : "بدء تقييم التمويل"}
        </button>
      </div>
    </div>
  );
}
