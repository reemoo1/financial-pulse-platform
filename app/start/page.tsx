"use client";

import Link from "next/link";
import { Building2, Rocket } from "lucide-react";

export default function StartPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20 text-center">
      <h1 className="font-heading text-3xl font-bold mb-3">هل أنت شركة؟</h1>
      <p className="text-fp-slate mb-12">
        اختر المسار المناسب لبدء التحليل الذكي
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Link
          href="/company/upload"
          className="group bg-white rounded-2xl p-8 shadow-card border border-black/5 hover:shadow-card-lg hover:-translate-y-1 transition-all"
        >
          <div className="w-14 h-14 mx-auto rounded-2xl bg-fp-green/10 flex items-center justify-center mb-4 group-hover:bg-fp-green/20 transition-colors">
            <Building2 className="w-7 h-7 text-fp-green" />
          </div>
          <h2 className="font-semibold text-lg mb-2">نعم</h2>
          <p className="text-sm text-fp-slate">
            لدي شركة قائمة وأرغب بتحليل المخاطر المالية وطلب التمويل
          </p>
        </Link>

        <Link
          href="/startup/wizard"
          className="group bg-white rounded-2xl p-8 shadow-card border border-black/5 hover:shadow-card-lg hover:-translate-y-1 transition-all"
        >
          <div className="w-14 h-14 mx-auto rounded-2xl bg-fp-gold/10 flex items-center justify-center mb-4 group-hover:bg-fp-gold/20 transition-colors">
            <Rocket className="w-7 h-7 text-fp-gold" />
          </div>
          <h2 className="font-semibold text-lg mb-2">لا، أريد إنشاء شركة</h2>
          <p className="text-sm text-fp-slate">
            لدي فكرة مشروع وأرغب بتقييم جدواها وفرص تمويلها
          </p>
        </Link>
      </div>

      <div className="flex justify-center gap-2 mt-12">
        <span className="w-2 h-2 rounded-full bg-fp-green" />
        <span className="w-2 h-2 rounded-full bg-black/10" />
        <span className="w-2 h-2 rounded-full bg-black/10" />
      </div>
    </div>
  );
}
