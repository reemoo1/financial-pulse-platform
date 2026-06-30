import Link from "next/link";
import { ShieldCheck, Zap, LineChart, BadgeCheck, Upload, Cpu, FileText, BarChart3 } from "lucide-react";

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-green-gradient text-white">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_20%,white,transparent_40%)]" />
        <div className="max-w-5xl mx-auto px-6 pt-20 pb-24 text-center relative">
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 text-fp-gold-light text-sm font-medium mb-6 border border-white/10">
            منصة ذكاء اصطناعي للبنوك والجهات التمويلية
          </span>
          <h1 className="font-heading text-3xl md:text-5xl font-bold leading-tight mb-6">
            كل قرض خاطئ يكلف البنك ملايين
            <br />
            <span className="text-fp-gold-light">النبض المالي يرصد المخاطر قبل أن تقع</span>
          </h1>
          <p className="text-white/80 max-w-2xl mx-auto mb-10 leading-relaxed">
            تحليل فوري لمخاطر التمويل المؤسسي باستخدام الذكاء الاصطناعي والنماذج
            الإحصائية، مع تقييم توافق رؤية 2030 وتوصيات تمويل دقيقة — في دقائق
            بدلاً من أسابيع.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/start"
              className="px-8 py-3.5 rounded-full bg-gold-gradient text-fp-ink font-bold shadow-card-lg hover:opacity-90 transition-opacity"
            >
              ابدأ التحليل
            </Link>
            <Link
              href="/start"
              className="px-8 py-3.5 rounded-full border border-white/30 text-white font-semibold hover:bg-white/10 transition-colors"
            >
              جرّب المنصة
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="font-heading text-2xl md:text-3xl font-bold text-center mb-2">
          كيف يعمل النبض المالي؟
        </h2>
        <p className="text-fp-slate text-center mb-12">
          أربع خطوات تفصل البنك عن قرار تمويل مدعوم بالذكاء الاصطناعي
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { icon: Upload, title: "رفع البيانات", desc: "رفع القوائم المالية أو تعبئة بيانات المشروع" },
            { icon: Cpu, title: "تحليل ذكي", desc: "نماذج إحصائية وتعلم آلي تحسب المؤشرات والمخاطر" },
            { icon: FileText, title: "تقرير شامل", desc: "تقرير ذكاء اصطناعي يشرح النتائج بوضوح" },
            { icon: BarChart3, title: "قرار تمويل", desc: "توصية بمبلغ التمويل ونسبة الفائدة ومستوى المخاطر" },
          ].map((step, i) => (
            <div
              key={step.title}
              className="bg-white rounded-2xl p-6 shadow-card border border-black/5 relative"
            >
              <div className="w-12 h-12 rounded-xl bg-fp-green/10 flex items-center justify-center mb-4">
                <step.icon className="w-6 h-6 text-fp-green" />
              </div>
              <span className="absolute top-4 left-4 text-xs font-bold text-fp-gold">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="font-semibold mb-1">{step.title}</h3>
              <p className="text-sm text-fp-slate leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-white border-y border-black/5">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-center mb-12">
            لماذا النبض المالي؟
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { icon: Zap, title: "سرعة", desc: "تحليل مالي كامل في دقائق بدلاً من أسابيع" },
              { icon: LineChart, title: "دقة", desc: "نماذج إحصائية وذكاء اصطناعي مدمجة" },
              { icon: BadgeCheck, title: "توافق رؤية 2030", desc: "تقييم مدى مساهمة التمويل في المستهدفات الوطنية" },
              { icon: ShieldCheck, title: "أمان وامتثال", desc: "بنية بيانات آمنة بمعايير القطاع المصرفي" },
            ].map((b) => (
              <div key={b.title} className="text-center px-4">
                <div className="w-14 h-14 mx-auto rounded-full bg-gold-gradient flex items-center justify-center mb-4">
                  <b.icon className="w-7 h-7 text-fp-ink" />
                </div>
                <h3 className="font-semibold mb-2">{b.title}</h3>
                <p className="text-sm text-fp-slate leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <h2 className="font-heading text-2xl md:text-3xl font-bold mb-4">
          جاهز لتقييم مخاطر التمويل القادم؟
        </h2>
        <p className="text-fp-slate mb-8">
          ابدأ الآن برفع القوائم المالية أو تقييم فكرة مشروع ناشئ.
        </p>
        <Link
          href="/start"
          className="inline-flex px-8 py-3.5 rounded-full bg-green-gradient text-white font-bold shadow-card-lg hover:opacity-90 transition-opacity"
        >
          ابدأ التحليل الآن
        </Link>
      </section>
    </div>
  );
}
