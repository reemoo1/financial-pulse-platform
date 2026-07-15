import { FileCheck2 } from "lucide-react";

const sections = [
  {
    title: "١. طبيعة الخدمة",
    body: "النبض المالي منصة تقنية تُسهّل تقديم طلبات التمويل ومراجعتها بين الشركات والجهة التمويلية، وتقدّم تقييمًا ماليًا أوليًا يعتمد على البيانات المُدخلة. القرار الائتماني النهائي يعود للبنك فقط.",
  },
  {
    title: "٢. صحة البيانات المقدَّمة",
    body: "يقع على مقدّم الطلب مسؤولية التأكد من صحة واكتمال البيانات والمستندات المرفوعة (القوائم المالية، كشف الحساب، السجل التجاري، هوية المفوض بالتوقيع). تقديم بيانات غير صحيحة قد يؤدي إلى رفض الطلب أو إلغاء الموافقة.",
  },
  {
    title: "٣. التقييم المالي ليس التزامًا بالتمويل",
    body: "نتائج التحليل المالي ودرجة الصحة المالية المعروضة في المنصة مؤشرات استرشادية أولية، ولا تُعد موافقة أو التزامًا من البنك بمنح التمويل قبل استكمال المراجعة الائتمانية الكاملة.",
  },
  {
    title: "٤. الضمانات",
    body: "قد تُطلب ضمانات إضافية بعد الموافقة المبدئية أو المشروطة حسب مستوى المخاطر المقدّرة، وتخضع لسياسة الضمانات المعمول بها لدى الجهة التمويلية.",
  },
  {
    title: "٥. الاستعلام عن الطلب",
    body: "يمكن متابعة حالة الطلب عبر رقم المعاملة ورمز التحقق (OTP) دون الحاجة لإنشاء حساب دائم. مسؤولية حفظ رقم المعاملة تقع على مقدّم الطلب.",
  },
  {
    title: "٦. التوثيق والتسويق",
    body: "بالمشاركة في الفعاليات المرتبطة بالمنصة، يوافق المشارك على إمكانية توثيق الحدث لأغراض تسويقية وإعلامية، وفق ما هو موضح في الملف الإرشادي للفعالية.",
  },
  {
    title: "٧. التعديلات على الشروط",
    body: "قد تُحدَّث هذه الشروط من وقت لآخر لتعكس تطوير الخدمة أو متطلبات نظامية جديدة، وسيُشار إلى تاريخ آخر تحديث أعلى الصفحة.",
  },
];

export default function TermsPage() {
  return (
    <section className="public-page-shell">
      <div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        <div className="mb-12 text-center">
          <span className="portal-kicker">قانوني</span>
          <h1 className="mt-5 font-heading text-3xl font-bold text-[#0F172A] md:text-5xl">
            الشروط والأحكام
          </h1>
          <p className="mt-4 text-sm leading-7 text-[#475569]">
            آخر تحديث: {new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        <div className="mb-10 flex gap-3 rounded-2xl border-r-2 border-[#C9793B] bg-white/60 px-5 py-4 text-sm leading-7 text-[#0B1F3A]">
          <FileCheck2 className="mt-1 h-5 w-5 shrink-0 text-[#C9793B]" />
          <p>استخدامك لمنصة النبض المالي وتقديمك لطلب تمويل يعني موافقتك على الشروط والأحكام التالية.</p>
        </div>

        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="mb-2 text-lg font-bold text-[#0F172A]">{section.title}</h2>
              <p className="text-sm leading-7 text-[#475569]">{section.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl bg-white/60 p-5 text-center text-sm text-[#475569]">
          لأي استفسار عن الشروط والأحكام، تواصل معنا على{" "}
          <a href="mailto:info@financialpulse.sa" className="font-bold text-[#0B1F3A] hover:text-[#C9793B]">
            info@financialpulse.sa
          </a>
        </div>
      </div>
    </section>
  );
}
