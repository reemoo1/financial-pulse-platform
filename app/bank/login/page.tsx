"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import AuthShell from "@/components/AuthShell";

export default function BankLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const endpoint =
        mode === "login" ? "/api/bank/auth/login" : "/api/bank/auth/register";
      const payload =
        mode === "login" ? { email, password } : { name, email, password };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok)
        throw new Error(
          json.error ||
            (mode === "login" ? "تعذر تسجيل الدخول." : "تعذر إنشاء الحساب."),
        );
      router.replace("/bank/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : mode === "login"
            ? "تعذر تسجيل الدخول."
            : "تعذر إنشاء الحساب.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      portalLabel="النبض المالي — بوابة البنك"
      headline="قرار ائتماني واضح، وحسابات قابلة للتفسير، وضمانات مرتبطة بكل طلب."
      features={[
        "عرض طريقة حساب التمويل خطوة بخطوة",
        "تحديث حالة الشركة فور صدور القرار",
        "إدارة الضمانات والصرف داخل ملف واحد",
        "مخاطر المحفظة محسوبة من المصدر نفسه",
      ]}
      panelTitle="دخول موظف البنك"
      panelSubtitle="أدخل بيانات الاعتماد المعتمدة للوصول إلى لوحة الائتمان والعمليات."
    >
      <form onSubmit={submit} className="space-y-5">
        {mode === "signup" && (
          <label>
            <span className="auth-field-label">الاسم</span>
            <input
              className="fp-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
        )}

        <label>
          <span className="auth-field-label">البريد الإلكتروني</span>
          <input
            className="fp-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@bank.sa"
            required
          />
        </label>

        <label>
          <span className="auth-field-label">كلمة المرور</span>
          <input
            className="fp-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>

        {error && <div className="auth-alert">{error}</div>}

        <button disabled={busy} className="portal-primary-btn h-12 w-full text-sm disabled:opacity-50">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "login" ? "تسجيل الدخول" : "إنشاء الحساب"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError("");
          }}
          className="bank-auth-mode-toggle"
          tabIndex={-1}
        >
          {mode === "login" ? "إنشاء حساب جديد" : "لدي حساب بالفعل"}
        </button>

        <div className="auth-trust-row">
          <ShieldCheck className="h-4 w-4" />
          <span>جلسة آمنة للموظفين المعتمدين فقط — لا تُشارك بيانات الدخول.</span>
        </div>
      </form>

      <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#D9E2EC] bg-[#F8FAFC] p-3">
        <div className="portal-icon-box h-10 w-10">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <p className="text-[11px] leading-6 text-[#64748B]">
          هذه البوابة مخصصة لفرق الائتمان والمخاطر والعمليات داخل البنك الشريك.
        </p>
      </div>
    </AuthShell>
  );
}
