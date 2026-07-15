"use client";

import Link from "next/link";
import { Building2, Rocket, ArrowLeft } from "lucide-react";

export default function StartPage() {
  return (
    <section className="public-page-shell">
      <div className="max-w-4xl mx-auto px-6 py-16 md:py-24">
        <div className="text-center mb-10 md:mb-14">
          <span className="portal-kicker">ابدأ رحلتك التمويلية</span>
          <h1 className="font-heading text-3xl md:text-5xl font-bold mt-5 mb-4 text-[#0F172A]">
            اختر المسار المناسب
            <span className="block portal-accent mt-2">وسنرشدك خطوة بخطوة</span>
          </h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Link href="/company/upload" className="public-option-card group">
            <div className="public-option-icon">
              <Building2 className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-xl mb-2 text-[#0F172A]">نعم، لدي شركة</h2>
              <p className="text-sm text-[#475569] leading-relaxed">
                ارفع القوائم المالية وبيانات الشركة للحصول على تقييم المخاطر وخطة التمويل المناسبة.
              </p>
            </div>
            <ArrowLeft className="w-5 h-5 text-[#C9793B] transition-transform duration-150 group-hover:-translate-x-1" />
          </Link>

          <Link href="/startup/wizard" className="public-option-card group">
            <div className="public-option-icon public-option-icon-alt">
              <Rocket className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-xl mb-2 text-[#0F172A]">لا، أريد إنشاء شركة</h2>
              <p className="text-sm text-[#475569] leading-relaxed">
                قيّم فكرة المشروع وجدواها وفرص التمويل قبل بدء النشاط التجاري.
              </p>
            </div>
            <ArrowLeft className="w-5 h-5 text-[#C9793B] transition-transform duration-150 group-hover:-translate-x-1" />
          </Link>
        </div>

        <div className="mt-8 text-center">
          <Link href="/inquiry" className="portal-link text-sm">
            لديك طلب سابق؟ استعلم عن رقم المعاملة
          </Link>
        </div>
      </div>
    </section>
  );
}
