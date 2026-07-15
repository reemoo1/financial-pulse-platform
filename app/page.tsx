import Link from "next/link";
import {
  Banknote,
  CheckCircle2,
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

const previewMetrics = [
  { label: "نسبة تغطية الدين", value: "1.42", status: "مستقر" },
  { label: "السيولة الجارية", value: "1.18", status: "مقبول" },
  { label: "احتمال التعثر", value: "12%", status: "منخفض" },
];

const previewTimeline = [
  { label: "التقديم", state: "done" },
  { label: "التحليل", state: "done" },
  { label: "المراجعة", state: "current" },
  { label: "القرار", state: "pending" },
];

export default function HomePage() {
  return (
    <div className="home-flow">
      <section className="home-hero">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 py-20 lg:grid-cols-[1.05fr_.95fr] lg:py-28">
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

          <div className="home-product-preview" aria-hidden="true">
            <div className="home-preview-window">
              <div className="home-preview-topbar">
                <div className="home-preview-brand">
                  <span className="home-preview-brand-mark" />
                  <span>لوحة تقييم التمويل</span>
                </div>
                <span className="home-preview-pill">قيد المراجعة</span>
              </div>

              <div className="home-preview-body">
                <div className="home-preview-score-card">
                  <div>
                    <p className="home-preview-label">درجة التمويل</p>
                    <p className="home-preview-score">78</p>
                    <p className="home-preview-tier">مخاطر متوسطة — ضمن الحدود المقبولة</p>
                  </div>
                  <div className="home-preview-ring" role="presentation">
                    <svg viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="32" className="home-preview-ring-track" />
                      <circle cx="40" cy="40" r="32" className="home-preview-ring-fill" />
                    </svg>
                  </div>
                </div>

                <div className="home-preview-metrics">
                  {previewMetrics.map((metric) => (
                    <div key={metric.label} className="home-preview-metric">
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                      <em>{metric.status}</em>
                    </div>
                  ))}
                </div>

                <div className="home-preview-footer">
                  <div className="home-preview-timeline">
                    {previewTimeline.map((step) => (
                      <div
                        key={step.label}
                        className={`home-preview-step home-preview-step--${step.state}`}
                      >
                        <span />
                        <p>{step.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="home-preview-decision">
                    <CheckCircle2 className="h-4 w-4" />
                    <div>
                      <p>ملخص القرار</p>
                      <span>موافقة مشروطة — بانتظار مستندات الضمان</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
