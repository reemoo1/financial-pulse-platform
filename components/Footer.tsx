export default function Footer() {
  return (
    <footer id="contact" className="bg-fp-ink text-white/70 mt-24">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <h3 className="font-heading text-xl text-white mb-3">النبض المالي</h3>
          <p className="text-sm leading-relaxed">
            منصة ذكاء اصطناعي لتحليل مخاطر التمويل المؤسسي للبنوك والجهات
            التمويلية في المملكة العربية السعودية.
          </p>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3">روابط سريعة</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="/" className="hover:text-fp-gold">الرئيسية</a></li>
            <li><a href="/start" className="hover:text-fp-gold">ابدأ التحليل</a></li>
            <li><a href="/#pricing" className="hover:text-fp-gold">الأسعار</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3">قانوني</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="#" className="hover:text-fp-gold">سياسة الخصوصية</a></li>
            <li><a href="#" className="hover:text-fp-gold">الشروط والأحكام</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3">تواصل معنا</h4>
          <p className="text-sm">info@financialpulse.sa</p>
          <p className="text-sm">الرياض، المملكة العربية السعودية</p>
        </div>
      </div>
      <div className="border-t border-white/10 text-center text-xs py-4">
        © {new Date().getFullYear()} النبض المالي. جميع الحقوق محفوظة.
      </div>
    </footer>
  );
}
