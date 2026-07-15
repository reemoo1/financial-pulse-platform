"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Landmark } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";

function PulseLogo() {
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

export default function Navbar() {
  const pathname = usePathname();

  if (pathname.startsWith("/bank") || pathname.startsWith("/inquiry")) return null;

  return (
    <header className="fp-nav">
      <div className="fp-nav-inner">
        <Link href="/" className="fp-nav-brand">
          <PulseLogo />
          <span className="font-heading font-bold text-sm sm:text-base text-[#0B1F3A] whitespace-nowrap">
            النبض المالي
          </span>
        </Link>

        <nav className="fp-nav-links">
          <Link href="/" className="fp-nav-link">
            الرئيسية
          </Link>
          <Link href="/start" className="fp-nav-link">
            المنصة
          </Link>
          <Link href="/#journey" className="fp-nav-link">
            رحلة التمويل
          </Link>
          <Link href="/#faq" className="fp-nav-link">
            الأسئلة الشائعة
          </Link>
        </nav>

        <div className="fp-nav-actions">
          <Link href="/bank/login" className="fp-nav-secondary">
            دخول البنك
            <Landmark className="w-4 h-4" />
          </Link>
          <LanguageSwitcher />
          <Link href="/start" className="fp-nav-primary hidden sm:inline-flex">
            ابدأ طلب التمويل
          </Link>
        </div>
      </div>
    </header>
  );
}
