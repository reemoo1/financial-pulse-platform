"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarClock,
  FileText,
  Gauge,
  Gavel,
  LogOut,
  Menu,
  ShieldCheck,
  X,
} from "lucide-react";
import { useState } from "react";
import { BANK_ROLE_LABELS } from "@/lib/bankAccess";
import { BankRole } from "@/lib/types";

type BankUserView = {
  name: string;
  email: string;
  role?: BankRole;
};

const NAV_ITEMS = [
  { href: "/bank/dashboard", label: "لوحة الائتمان", icon: Gauge },
  { href: "/bank/requests", label: "طلبات التمويل", icon: FileText },
  { href: "/bank/credit-decisions", label: "قرار الائتمان", icon: Gavel },
  { href: "/bank/collateral", label: "الضمانات", icon: ShieldCheck },
  { href: "/bank/monitoring", label: "المتابعة الشهرية", icon: CalendarClock },
];

function BankLogoMark() {
  return (
    <span className="fp-logo-mark">
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="4" fill="#0B1F3A" />
        <path
          d="M6 14h2.5l1.5-5 2.5 8 2-6 1.5 3H18"
          stroke="#C9793B"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export default function BankShell({
  user,
  title,
  subtitle,
  children,
}: {
  user: BankUserView;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/bank/auth/logout", { method: "POST" });
    router.replace("/bank/login");
    router.refresh();
  }

  return (
    <div className="bank-portal min-h-screen text-[#0F172A]" dir="rtl">
      {open && (
        <button
          aria-label="إغلاق القائمة"
          className="fixed inset-0 z-30 bg-[#0B1F3A]/35 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 right-0 z-40 w-72 border-l border-[#13294B] bg-[#0B1F3A] text-white transition-transform duration-150 lg:translate-x-0 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col p-5">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-5">
            <Link href="/bank/dashboard" className="flex items-center gap-3">
              <BankLogoMark />
              <div>
                <p className="font-bold">بوابة البنك</p>
                <p className="mt-0.5 text-[10px] text-slate-400">النبض المالي</p>
              </div>
            </Link>
            <button className="lg:hidden" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="mt-6 space-y-2">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors duration-150 ${
                    active
                      ? "bg-[#C9793B] text-white"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <item.icon className="h-4.5 w-4.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C9793B]/15 text-[#D88945]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{user.name}</p>
                <p className="mt-0.5 truncate text-[10px] text-slate-400">
                  {BANK_ROLE_LABELS[user.role || "admin"]}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 transition-colors duration-150 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              تسجيل الخروج
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pr-72">
        <header className="fp-nav sticky top-0 z-20 border-b border-[#D9E2EC] bg-white px-4 py-4 sm:px-7">
          <div className="mx-auto flex max-w-7xl items-center gap-4">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D9E2EC] bg-white lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="فتح القائمة"
            >
              <Menu className="h-5 w-5 text-[#0B1F3A]" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-[#0F172A] sm:text-xl">{title}</h1>
              {subtitle && <p className="mt-1 text-xs text-[#64748B]">{subtitle}</p>}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-7 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
