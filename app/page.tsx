import Link from "next/link";
import {
  Banknote,
  ChevronDown,
  Clock,
  FileSearch,
  Landmark,
  Search,
  ShieldCheck,
  TrendingUp,
  Upload,
} from "lucide-react";

const journey = [
  { icon: Upload, title: "التقديم والتحليل", desc: "رفع البيانات وتحليل المؤشرات المالية والمخاطر." },
  { icon: FileSearch, title: "الدراسة والاعتماد", desc: "مراجعة البنك للبيانات والمستندات واتخاذ القرار." },
  { icon: Banknote, title: "الصرف والمتابعة", desc: "صرف التمويل ومتابعة الأقساط بشكل دوري." },
  { icon: Landmark, title: "التسوية والإغلاق", desc: "سداد كامل الالتزامات وإغلاق الطلب." },
];

const faqs = [
  ["هل كل طلب تمويل يحتاج ضماناً؟", "لا. يبدأ القرار من قدرة الشركة على السداد من التدفقات النقدية، وتُطلب الضمانات كخط حماية ثانٍ عندما تبرر المخاطر ذلك."],
  ["متى أرفع مستندات الضمان؟", "بعد الموافقة المبدئية أو المشروطة. تظهر حزمة الضمان المطلوبة داخل الاستعلام عن المعاملة بعد التحقق برمز OTP."],
  ["ما الفرق بين الموافقة المشروطة والنهائية؟", "الموافقة المشروطة تعني قبولاً مبدئياً مع متطلبات يجب استيفاؤها. تصبح الموافقة نهائية بعد التحقق من الشروط والضمانات المطلوبة."],
  ["كيف تتم المتابعة بعد الصرف؟", "يظهر جدول الأقساط وسجل الصرف والمتابعة الدورية والإنذار المبكر داخل صفحة الاستعلام نفسها دون الحاجة إلى إنشاء حساب شركة."],
];

const benefits = [
  { title: "تحليل مالي فوري", text: "تحويل البيانات إلى مؤشرات قابلة للفهم والمراجعة.", icon: TrendingUp },
  { title: "إنذار مبكر", text: "اكتشاف إشارات السيولة والمديونية قبل تفاقمها.", icon: Clock },
  { title: "قرار مفسر", text: "إظهار أسباب التوصية والحدود المستخدمة في الحساب.", icon: ShieldCheck },
  { title: "رحلة تمويل واضحة", text: "أربع مراحل أساسية من التقديم حتى الإغلاق.", icon: Landmark },
];

export default function HomePage() {
  return (
    <div className="home-flow">
      <section className="home-hero">
        <div className="home-hero-inner mx-auto max-w-7xl px-6 py-20 lg:grid lg:grid-cols-[1.25fr_1.2fr] lg:items-center lg:gap-12 lg:py-28">
          <div className="text-center lg:text-right">
            <span className="section-kicker">رحلة تمويل واضحة من التحليل حتى المتابعة</span>
            <h1 className="mt-6 font-heading text-4xl font-bold leading-[1.3] text-[#0F172A] md:text-[3.25rem]">
              التمويل القادم يبدأ من هنا
              <span className="home-hero-accent mt-3 block">بقرار واضح، مفسر، وقابل للمراجعة</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[#475569] lg:mx-0">
              منصة تمويل مؤسسية تربط البيانات المالية بقرار الاعتماد — بشفافية كاملة في كل مرحلة.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Link href="/start" className="home-primary-action">ابدأ طلب التمويل</Link>
              <Link href="/inquiry" className="home-secondary-action">
                <Search className="h-4 w-4" />
                استعلام عن رقم المعاملة
              </Link>
            </div>
          </div>

          <div className="home-hero-illustration" aria-hidden="true">
            <svg viewBox="0 0 400 320" fill="none" xmlns="http://www.w3.org/2000/svg" role="presentation">
              <rect x="6" y="12" width="388" height="296" rx="24" fill="rgba(15, 40, 78, 0.42)" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1.2" />
              <rect x="6" y="12" width="388" height="296" rx="24" fill="url(#heroGlass)" />

              <rect x="22" y="30" width="52" height="260" rx="14" fill="rgba(8, 28, 58, 0.35)" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="1" />

              <rect x="32" y="46" width="32" height="32" rx="8" fill="rgba(12, 36, 72, 0.5)" stroke="#d88945" strokeWidth="1.4" />
              <g transform="translate(36 50)">
                <rect x="3" y="3" width="18" height="18" rx="4" fill="#0B1F3A" />
                <path
                  d="M6 14h2.5l1.5-5 2.5 8 2-6 1.5 3H18"
                  stroke="#C9793B"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>

              <circle cx="54" cy="104" r="2.4" fill="rgba(255,255,255,0.35)" />
              <circle cx="54" cy="116" r="2.4" fill="rgba(255,255,255,0.35)" />
              <circle cx="42" cy="104" r="2.4" fill="rgba(255,255,255,0.35)" />
              <circle cx="42" cy="116" r="2.4" fill="rgba(255,255,255,0.35)" />

              <circle cx="48" cy="148" r="10" stroke="rgba(255,255,255,0.28)" strokeWidth="2.5" />
              <circle cx="48" cy="148" r="10" stroke="#d88945" strokeWidth="2.5" strokeDasharray="20 42" strokeLinecap="round" transform="rotate(-35 48 148)" />

              <rect x="40" y="176" width="5" height="16" rx="1" fill="rgba(255,255,255,0.22)" />
              <rect x="47" y="182" width="5" height="10" rx="1" fill="rgba(255,255,255,0.18)" />
              <rect x="54" y="170" width="5" height="22" rx="1" fill="rgba(255,255,255,0.24)" />

              <rect x="38" y="210" width="24" height="28" rx="5" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" />
              <line x1="42" y1="218" x2="58" y2="218" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="42" y1="225" x2="56" y2="225" stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="42" y1="232" x2="54" y2="232" stroke="rgba(255,255,255,0.14)" strokeWidth="1.2" strokeLinecap="round" />

              <rect x="88" y="30" width="142" height="128" rx="16" fill="rgba(10, 32, 64, 0.38)" stroke="rgba(255, 255, 255, 0.07)" strokeWidth="1" />
              <circle cx="130" cy="86" r="26" stroke="rgba(100, 140, 190, 0.45)" strokeWidth="5.5" />
              <circle cx="130" cy="86" r="26" stroke="#5b8ec4" strokeWidth="5.5" strokeDasharray="32 130" strokeLinecap="round" transform="rotate(-60 130 86)" />
              <rect x="168" y="70" width="44" height="6" rx="3" fill="rgba(255,255,255,0.14)" />
              <rect x="168" y="84" width="34" height="6" rx="3" fill="rgba(255,255,255,0.1)" />
              <rect x="168" y="98" width="38" height="6" rx="3" fill="rgba(255,255,255,0.08)" />

              <rect x="242" y="30" width="142" height="128" rx="16" fill="rgba(10, 32, 64, 0.38)" stroke="rgba(255, 255, 255, 0.07)" strokeWidth="1" />
              <path d="M258 128 L280 108 L300 116 L322 86 L348 72" stroke="rgba(120, 165, 210, 0.55)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="258" cy="128" r="3.5" fill="rgba(255,255,255,0.35)" />
              <circle cx="280" cy="108" r="3.5" fill="rgba(255,255,255,0.35)" />
              <circle cx="300" cy="116" r="3.5" fill="rgba(255,255,255,0.35)" />
              <circle cx="322" cy="86" r="3.5" fill="rgba(255,255,255,0.35)" />
              <circle cx="348" cy="72" r="3.5" fill="rgba(255,255,255,0.35)" />

              <rect x="88" y="170" width="142" height="128" rx="16" fill="rgba(10, 32, 64, 0.38)" stroke="rgba(255, 255, 255, 0.07)" strokeWidth="1" />
              <rect x="104" y="252" width="12" height="24" rx="2" fill="rgba(80, 120, 170, 0.35)" />
              <rect x="122" y="236" width="12" height="40" rx="2" fill="rgba(90, 135, 185, 0.42)" />
              <rect x="140" y="244" width="12" height="32" rx="2" fill="rgba(70, 110, 160, 0.32)" />
              <rect x="158" y="226" width="12" height="50" rx="2" fill="rgba(100, 145, 195, 0.48)" />
              <rect x="176" y="234" width="12" height="42" rx="2" fill="rgba(85, 125, 175, 0.38)" />
              <rect x="194" y="220" width="12" height="56" rx="2" fill="rgba(95, 140, 190, 0.45)" />

              <rect x="242" y="170" width="142" height="128" rx="16" fill="rgba(10, 32, 64, 0.38)" stroke="rgba(255, 255, 255, 0.07)" strokeWidth="1" />
              <rect x="260" y="196" width="62" height="6" rx="3" fill="rgba(255,255,255,0.12)" />
              <rect x="260" y="216" width="82" height="6" rx="3" fill="rgba(255,255,255,0.1)" />
              <rect x="260" y="236" width="52" height="6" rx="3" fill="rgba(255,255,255,0.12)" />
              <rect x="260" y="256" width="70" height="6" rx="3" fill="rgba(255,255,255,0.08)" />
              <circle cx="254" cy="239" r="3.5" fill="#d88945" />

              <defs>
                <linearGradient id="heroGlass" x1="200" y1="12" x2="200" y2="308" gradientUnits="userSpaceOnUse">
                  <stop stopColor="rgba(20, 55, 100, 0.18)" />
                  <stop offset="1" stopColor="rgba(8, 22, 48, 0.32)" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </section>

      <section id="journey" className="home-section">
        <div className="mx-auto max-w-7xl px-6 py-16 md:py-20">
          <div className="text-center">
            <span className="home-section-label">رحلة التمويل</span>
            <h2 className="mt-3 font-heading text-3xl font-bold text-[#0F172A]">
              كل مرحلة واضحة قبل الانتقال إلى التالية
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[#475569]">
              لا تُطلب الضمانات من البداية، ولا يبدأ الصرف قبل الموافقة النهائية واستكمال التوثيق.
            </p>
          </div>

          <div className="journey-line mt-12" dir="rtl">
            {journey.map((step, index) => (
              <div
                className={`journey-step${index === 0 ? " journey-step-current" : ""}`}
                key={step.title}
              >
                <div className="journey-node">
                  <step.icon className="h-5 w-5" />
                </div>
                <span className="journey-number">{String(index + 1).padStart(2, "0")}</span>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
                {index === 0 && <span className="journey-current-badge">المرحلة الحالية</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="documents" className="home-section home-section-alt">
        <div className="mx-auto max-w-7xl px-6 py-16 md:py-20">
          <div className="grid gap-12 lg:grid-cols-[.95fr_1.05fr] lg:items-start">
            <div>
              <span className="home-section-label">النبض المالي</span>
              <h2 className="mt-3 font-heading text-3xl font-bold leading-tight text-[#0F172A] md:text-4xl">
                يرصد المخاطر قبل أن تقع
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#475569]">
                تحليل واضح يربط المؤشرات المالية بقرار التمويل ويكشف إشارات الخطر مبكرًا، دون تعقيد أو نتائج غير مفسرة.
              </p>
              <Link href="/start" className="home-primary-action mt-7 inline-flex">
                ابدأ رحلة التمويل
              </Link>
            </div>

            <div>
              <p className="text-sm font-bold text-[#0F172A]">قدرات المنصة</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {benefits.map(({ title, text, icon: Icon }) => (
                  <div key={title} className="home-benefit-card">
                    <Icon className="h-5 w-5" />
                    <h3 className="mt-3 font-bold text-[#0F172A]">{title}</h3>
                    <p className="mt-2 text-xs leading-6 text-[#475569]">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="home-section">
        <div className="mx-auto max-w-5xl px-6 py-16 md:py-20">
          <div className="text-center">
            <span className="home-section-label">الأسئلة الشائعة</span>
            <h2 className="mt-3 font-heading text-3xl font-bold text-[#0F172A]">قبل البدء</h2>
          </div>
          <div className="faq-lines mt-10">
            {faqs.map(([question, answer]) => (
              <details key={question} className="faq-line group">
                <summary>
                  <span>{question}</span>
                  <ChevronDown className="h-5 w-5 text-[#64748B] transition-transform duration-150 group-open:rotate-180" />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
