"use client";

import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();
  if (pathname.startsWith("/bank") || pathname.startsWith("/inquiry")) return null;

  return (
    <footer id="contact" className="fp-footer">
      <div className="fp-footer-inner">
        <div>
          <h3 className="font-heading text-xl text-[#0B1F3A] mb-3">النبض المالي</h3>
          <p className="text-sm leading-relaxed text-[#475569]">
            منصة تمويل مؤسسية تساعد البنوك والجهات التمويلية على اتخاذ قرارات واضحة
            ومبنية على بيانات — بشفافية ومساءلة في كل مرحلة.
          </p>
        </div>
        <div>
          <h4 className="text-[#0B1F3A] font-semibold mb-3">روابط سريعة</h4>
          <ul className="space-y-2 text-sm text-[#475569]">
            <li><a href="/" className="fp-footer-link">الرئيسية</a></li>
            <li><a href="/start" className="fp-footer-link">ابدأ طلب التمويل</a></li>
            <li><a href="/inquiry" className="fp-footer-link">الاستعلام عن المعاملة</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-[#0B1F3A] font-semibold mb-3">قانوني</h4>
          <ul className="space-y-2 text-sm text-[#475569]">
            <li><a href="#" className="fp-footer-link">سياسة الخصوصية</a></li>
            <li><a href="/terms" className="fp-footer-link">الشروط والأحكام</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-[#0B1F3A] font-semibold mb-3">تواصل معنا</h4>
          <p className="text-sm text-[#475569]">info@financialpulse.sa</p>
          <p className="text-sm text-[#475569]">الرياض، المملكة العربية السعودية</p>
        </div>
      </div>
      <div className="fp-footer-bottom">
        © {new Date().getFullYear()} النبض المالي. جميع الحقوق محفوظة.
      </div>
    </footer>
  );
}
