// بيانات ثابتة لثلاث حالات محاكاة (توضيحية) لغرض العرض في الهاكاثون فقط.
// تُستخدم في واجهة البنك (components/bank/MonitoringSimulationCases.tsx)
// وفي صفحة الاستعلام التجريبية للشركة (app/inquiry/demo/page.tsx).
// رقم المعاملة ورمز التحقق هنا ثابتان (غير مرتبطين بقاعدة البيانات الحقيقية
// ولا بنظام OTP الفعلي) حتى يمكن عرض تجربة الاستعلام فورًا بدون بريد إلكتروني حقيقي.

export type ActionStep = {
  label: string;
  detail: string;
  done: boolean;
};

export type DemoScenario = {
  key: string;
  referenceNumber: string;
  otp: string;
  companyName: string;
  sector: string;
  amount?: number;
  commitmentRate: number;
  overdueInstallments: number;
  daysLate: number;
  riskLevel: "high" | "medium" | "low";
  bankAlert: string;
  companyAlert: string;
  actions: ActionStep[];
  conditions: string[];
};

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    key: "high",
    referenceNumber: "10001",
    otp: "111222",
    companyName: "شركة الأفق للمقاولات",
    sector: "مقاولات",
    amount: 20_000_000,
    commitmentRate: 45,
    overdueInstallments: 2,
    daysLate: 61,
    riskLevel: "high",
    bankAlert: "تنبيه عاجل: تعثر فعلي في السداد — يوصى باتخاذ الإجراءات النظامية فورًا.",
    companyAlert: "إشعار للشركة بضرورة السداد خلال فترة السماح، وإلا يُفعَّل الضمان البنكي وفق العقد.",
    actions: [
      { label: "رصد التأخر في القسطين المستحقين", detail: "تلقائي فور مرور موعد الاستحقاق دون سداد", done: true },
      { label: "إشعار تلقائي للشركة بالتأخير", detail: "يرسل فور تجاوز موعد الاستحقاق", done: true },
      { label: "تنبيه عاجل لموظف البنك", detail: "يظهر في لوحة الائتمان بحالة \"تعثر\"", done: true },
      { label: "فترة سماح محددة بالعقد", detail: "مهلة أخيرة للشركة قبل تصعيد الإجراء", done: true },
      { label: "تحذير رسمي بتفعيل الضمان", detail: "يُرسل إذا انتهت فترة السماح دون سداد", done: false },
      { label: "رهن الضمان البنكي تمهيدًا لبيعه", detail: "إجراء نظامي أخير لاسترداد قيمة التمويل", done: false },
    ],
    conditions: [
      "تجاوز قسطين متتاليين دون سداد.",
      "انتهاء فترة السماح النظامية دون استجابة من الشركة.",
      "موافقة موظف الائتمان المخوّل على تفعيل الضمان.",
    ],
  },
  {
    key: "medium",
    referenceNumber: "10002",
    otp: "222333",
    companyName: "شركة النخبة التجارية",
    sector: "تجارة",
    commitmentRate: 80,
    overdueInstallments: 1,
    daysLate: 30,
    riskLevel: "medium",
    bankAlert: "تنبيه أولي يوضح مدة التأخير — يوصى بالمتابعة الدورية دون إجراءات قانونية حاليًا.",
    companyAlert: "تذكير بالدفعات المستحقة، مع إشعار بأن استمرار التأخير قد يؤثر على التصنيف الائتماني.",
    actions: [
      { label: "رصد تأخر السداد عن الموعد المحدد", detail: "تلقائي فور مرور موعد الاستحقاق دون سداد", done: true },
      { label: "تذكير تلقائي للشركة بالدفعة المستحقة", detail: "يتكرر أسبوعيًا حتى السداد أو التصعيد", done: true },
      { label: "تنبيه أولي لموظف البنك بمدة التأخير", detail: "يظهر في لوحة المتابعة بحالة \"تأخير\"", done: true },
      { label: "تحديث التصنيف الائتماني إذا استمر التأخير", detail: "يُنفَّذ تلقائيًا بعد تجاوز مهلة إضافية", done: false },
    ],
    conditions: [
      "تأخر السداد شهرين متتاليين كحد أقصى قبل التصعيد لحالة تعثر.",
      "عدم تفعيل أي إجراء نظامي طالما نسبة الالتزام أعلى من الحد الأدنى المتفق عليه.",
    ],
  },
  {
    key: "low",
    referenceNumber: "10003",
    otp: "333444",
    companyName: "شركة التقنية الحديثة",
    sector: "تقنية المعلومات",
    commitmentRate: 100,
    overdueInstallments: 0,
    daysLate: 0,
    riskLevel: "low",
    bankAlert: "تقرير إيجابي ولوحة متابعة تؤكد سداد جميع الدفعات في وقتها — يوصى باستمرار العلاقة التمويلية.",
    companyAlert: "تأكيد استلام كل دفعة فور سدادها، مع تصنيف ائتماني ممتاز.",
    actions: [
      { label: "تأكيد استلام كل قسط في موعده", detail: "تلقائي عند مطابقة الدفعة بجدول السداد", done: true },
      { label: "تحديث لوحة المتابعة بحالة \"ملتزمة\"", detail: "تلقائي بعد كل دفعة مؤكدة", done: true },
      { label: "توصية باستمرار العلاقة وإمكانية تمويل مستقبلي", detail: "تُعرض لموظف الائتمان عند اكتمال دورة السداد", done: true },
    ],
    conditions: [
      "الحفاظ على نسبة التزام 100% طوال مدة التمويل.",
      "عدم وجود أي قسط متأخر لأكثر من الفترة النظامية المسموحة.",
    ],
  },
];

export function findDemoScenarioByReference(reference: string): DemoScenario | null {
  const clean = reference.trim().toUpperCase();
  return DEMO_SCENARIOS.find((s) => s.referenceNumber.toUpperCase() === clean) || null;
}
