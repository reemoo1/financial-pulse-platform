import Link from "next/link";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 bg-fp-paper/90 backdrop-blur-md border-b border-black/5">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-heading text-2xl font-bold text-fp-green">
            النبض المالي
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-fp-slate">
          <Link href="/" className="hover:text-fp-green transition-colors">
            الرئيسية
          </Link>
          <Link href="/start" className="hover:text-fp-green transition-colors">
            المنصة
          </Link>
          <Link href="/#pricing" className="hover:text-fp-green transition-colors">
            الأسعار
          </Link>
          <Link href="/#contact" className="hover:text-fp-green transition-colors">
            تواصل معنا
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/start"
            className="hidden sm:inline-flex items-center px-5 py-2 rounded-full bg-green-gradient text-white text-sm font-semibold shadow-card hover:opacity-90 transition-opacity"
          >
            ابدأ التحليل
          </Link>
        </div>
      </div>
    </header>
  );
}
