"use client";

import { useState } from "react";
import { FileUp, Loader2 } from "lucide-react";

export default function InquiryMonitoringUpload({ requestId }: { requestId: string }) {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    if (!file || !period) {
      setMessage({ ok: false, text: "يرجى اختيار الفترة والملف." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("period", period);
      form.append("note", note);
      form.append("file", file);
      const response = await fetch(`/api/inquiries/${requestId}/monitoring-documents`, {
        method: "POST",
        body: form,
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "تعذر رفع الملف.");
      setMessage({ ok: true, text: "تم رفع القوائم الدورية وإرسالها للبنك. أعد تنفيذ الاستعلام لرؤية آخر تحديث." });
      setFile(null);
      setNote("");
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "تعذر رفع الملف." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inquiry-monitor-upload">
      <div>
        <p className="text-xs font-bold text-[#0B1F3A]">رفع القوائم أو كشف الحساب الدوري</p>
        <p className="mt-1 text-[11px] leading-5 text-fp-slate">PDF أو Excel أو CSV. تصل المرفقات مباشرة إلى ملف الطلب لدى البنك.</p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[150px_1fr]">
        <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
        <input type="file" accept=".pdf,.xlsx,.xls,.csv" onChange={(event) => setFile(event.target.files?.[0] || null)} />
      </div>
      <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="ملاحظات على الفترة (اختياري)" />
      {message && <p className={message.ok ? "is-ok" : "is-error"}>{message.text}</p>}
      <button type="button" onClick={submit} disabled={busy || !file}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
        رفع وإرسال للبنك
      </button>
    </div>
  );
}
