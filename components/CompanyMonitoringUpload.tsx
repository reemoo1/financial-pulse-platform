"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";

export default function CompanyMonitoringUpload({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    if (!file || !period) return setMessage("يرجى اختيار الفترة والملف.");
    setBusy(true); setMessage("");
    try {
      const form = new FormData();
      form.append("period", period); form.append("note", note); form.append("file", file);
      const res = await fetch(`/api/company/financing-requests/${requestId}/monitoring-documents`, { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "تعذر رفع الملف.");
      setMessage("تم رفع القوائم وإرسالها للبنك."); setFile(null); setNote(""); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر رفع الملف."); }
    finally { setBusy(false); }
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="font-bold">رفع القوائم المالية الدورية</h2>
    <p className="mt-1 text-xs text-slate-500">ارفعي القوائم الشهرية أو كشف الحساب ليظهر مباشرة لموظف البنك.</p>
    <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr]">
      <input type="month" value={period} onChange={(e)=>setPeriod(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      <input type="file" accept=".pdf,.xlsx,.xls,.csv" onChange={(e)=>setFile(e.target.files?.[0] || null)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
    </div>
    <textarea value={note} onChange={(e)=>setNote(e.target.value)} className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm" placeholder="ملاحظات على القوائم" />
    {message && <p className="mt-3 text-xs text-slate-600">{message}</p>}
    <button onClick={submit} disabled={busy || !file} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0B1F3A] text-xs font-bold text-white transition-colors duration-150 hover:bg-[#13294B] disabled:opacity-50">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<FileUp className="h-4 w-4"/>}رفع وإرسال للبنك</button>
  </section>;
}
