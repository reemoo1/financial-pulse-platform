"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FileDropzone from "@/components/FileDropzone";
import { SECTORS } from "@/lib/financial";
import { Loader2 } from "lucide-react";

const MANUAL_FIELDS: { key: string; label: string }[] = [
  { key: "currentAssets", label: "الأصول المتداولة (ريال)" },
  { key: "currentLiabilities", label: "الالتزامات المتداولة (ريال)" },
  { key: "totalAssets", label: "إجمالي الأصول (ريال)" },
  { key: "totalLiabilities", label: "إجمالي الالتزامات (ريال)" },
  { key: "netIncome", label: "صافي الربح (ريال)" },
  { key: "revenue", label: "الإيرادات (ريال)" },
  { key: "operatingCashFlow", label: "التدفقات النقدية التشغيلية (ريال)" },
];

export default function CompanyUploadPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"upload" | "manual">("upload");
  const [companyName, setCompanyName] = useState("");
  const [sector, setSector] = useState(SECTORS[0]);
  const [city, setCity] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!companyName.trim()) {
      setError("يرجى إدخال اسم الشركة");
      return;
    }
    if (tab === "upload" && !file) {
      setError("يرجى رفع ملف القوائم المالية أو التبديل إلى الإدخال اليدوي");
      return;
    }
    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.append("companyName", companyName);
    formData.append("sector", sector);
    formData.append("city", city);
    formData.append("sourceMethod", tab);

    if (tab === "upload" && file) {
      formData.append("file", file);
    } else {
      MANUAL_FIELDS.forEach((f) => {
        formData.append(f.key, manualValues[f.key] || "0");
      });
    }

    try {
      const res = await fetch("/api/companies/analyze", {
        method: "POST",
        body: formData,
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
      <h1 className="font-heading text-2xl font-bold mb-2">رفع القوائم المالية</h1>
      <p className="text-fp-slate mb-8">
        أدخل بيانات الشركة الأساسية، ثم ارفع القوائم المالية أو أدخل المؤشرات يدوياً
      </p>

      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-card border border-black/5 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">اسم الشركة</label>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-black/10 focus:border-fp-green focus:outline-none"
              placeholder="مثال: شركة الأفق للتجارة"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">القطاع</label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-black/10 focus:border-fp-green focus:outline-none bg-white"
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
              className="w-full px-4 py-2.5 rounded-lg border border-black/10 focus:border-fp-green focus:outline-none"
              placeholder="مثال: الرياض"
            />
          </div>
        </div>

        <div className="flex gap-2 border-b border-black/10">
          <button
            onClick={() => setTab("upload")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "upload" ? "border-fp-green text-fp-green" : "border-transparent text-fp-slate"
            }`}
          >
            رفع ملف
          </button>
          <button
            onClick={() => setTab("manual")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "manual" ? "border-fp-green text-fp-green" : "border-transparent text-fp-slate"
            }`}
          >
            إدخال يدوي
          </button>
        </div>

        {tab === "upload" ? (
          <div>
            <FileDropzone file={file} onFileSelected={setFile} />
            <p className="text-xs text-fp-slate mt-2">
              سيتم استخراج المؤشرات المالية تلقائياً من الملف. للملفات بصيغة PDF،
              استخدم الإدخال اليدوي مؤقتاً.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MANUAL_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium mb-1.5">{f.label}</label>
                <input
                  type="number"
                  value={manualValues[f.key] || ""}
                  onChange={(e) =>
                    setManualValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 rounded-lg border border-black/10 focus:border-fp-green focus:outline-none"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-risk-high">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-green-gradient text-white font-bold shadow-card hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "جاري تحليل البيانات..." : "بدء التحليل"}
        </button>
      </div>
    </div>
  );
}
