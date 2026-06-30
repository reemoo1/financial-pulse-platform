import {
  StartupAnalysisInput,
  StartupReportData,
  SwotAnalysis,
  RoadmapPhase,
} from "./types";
import { computeVision2030Score } from "./financial";

const SECTOR_SUCCESS_BASE: Record<string, number> = {
  "تقنية المعلومات": 62,
  "الصناعة والتصنيع": 50,
  "الطاقة المتجددة": 55,
  "السياحة والترفيه": 52,
  "الخدمات اللوجستية": 54,
  "التجارة والتجزئة": 48,
  "العقارات والمقاولات": 45,
  "الرعاية الصحية": 58,
  "التعليم": 56,
  "الزراعة والأغذية": 50,
  "أخرى": 45,
};

const FUNDING_SOURCES_BY_SECTOR: Record<string, string[]> = {
  "تقنية المعلومات": ["صندوق جسور", "بنك التنمية الاجتماعية", "مسرعات تقنية خاصة"],
  "الصناعة والتصنيع": ["صندوق التنمية الصناعية السعودي", "بنوك تجارية", "هيئة تنمية الصادرات"],
  "الطاقة المتجددة": ["صندوق الاستثمارات العامة", "بنك التصدير والاستيراد السعودي"],
  default: ["بنك التنمية الاجتماعية", "صندوق ريادة", "بنوك تجارية محلية"],
};

export function analyzeStartup(input: StartupAnalysisInput): StartupReportData {
  const base = SECTOR_SUCCESS_BASE[input.sector] ?? SECTOR_SUCCESS_BASE["أخرى"];

  // Capital adequacy: how much of the expected budget is already covered.
  const capitalCoverage =
    input.expectedBudget > 0
      ? clamp(input.currentCapital / input.expectedBudget, 0, 1)
      : 0;
  const capitalScore = Math.round(capitalCoverage * 20); // up to +20

  // Team scale signal (very small or very large relative to budget both
  // shave a couple points; a "reasonable" team size for the budget adds).
  const teamScore = input.employeeCount >= 2 && input.employeeCount <= 50 ? 8 : 3;

  // Clarity signal: did the founder articulate goals/audience/revenue model.
  const clarityScore =
    (input.goals?.trim().length > 15 ? 4 : 0) +
    (input.targetAudience?.trim().length > 10 ? 4 : 0) +
    (input.revenueSources?.trim().length > 10 ? 4 : 0);

  const successProbability = clamp(
    Math.round(base + capitalScore + teamScore + clarityScore - 10),
    5,
    95
  );

  const feasible = successProbability >= 50;

  const vision2030 = computeVision2030Score(input.sector, input.employeeCount);

  const fundingNeeded = Math.max(
    Math.round((input.expectedBudget - input.currentCapital) / 10000) * 10000,
    0
  );
  const recommendedCapital = Math.round(
    (input.expectedBudget * 1.15) / 10000
  ) * 10000;

  const paybackMonths = clamp(
    Math.round(24 - successProbability / 5),
    6,
    48
  );

  const risks = buildRisks(input, successProbability, capitalCoverage);
  const swot = buildSwot(input, successProbability);
  const roadmap = buildRoadmap(input);
  const fundingSources =
    FUNDING_SOURCES_BY_SECTOR[input.sector] ?? FUNDING_SOURCES_BY_SECTOR.default;

  const narrative = buildTemplateNarrative(input, successProbability, feasible, vision2030.score);

  return {
    input,
    feasible,
    successProbability,
    vision2030,
    risks,
    recommendedCapital,
    fundingNeeded,
    paybackMonths,
    fundingSources,
    swot,
    roadmap,
    narrative,
  };
}

function buildRisks(
  input: StartupAnalysisInput,
  successProbability: number,
  capitalCoverage: number
): string[] {
  const risks: string[] = [];
  if (capitalCoverage < 0.3) {
    risks.push("فجوة تمويلية كبيرة بين رأس المال الحالي والميزانية المتوقعة");
  }
  if (input.employeeCount === 0) {
    risks.push("عدم وجود فريق تأسيسي معلن قد يؤثر على القدرة التنفيذية");
  }
  if (successProbability < 50) {
    risks.push("مؤشرات أولية تستدعي إعادة تقييم نموذج العمل قبل طلب التمويل");
  }
  risks.push("مخاطر السوق العامة المرتبطة بالقطاع والمنافسة");
  risks.push("مخاطر تشغيلية متعلقة بسرعة النمو مقابل التدفقات النقدية");
  return risks;
}

function buildSwot(
  input: StartupAnalysisInput,
  successProbability: number
): SwotAnalysis {
  return {
    strengths: [
      `فكرة موجهة لقطاع ${input.sector}`,
      input.targetAudience
        ? `جمهور مستهدف محدد بوضوح: ${input.targetAudience}`
        : "وجود رؤية أولية للجمهور المستهدف",
    ],
    weaknesses: [
      input.currentCapital < input.expectedBudget * 0.3
        ? "رأس المال الحالي أقل من الحد الموصى به لمرحلة الانطلاق"
        : "حاجة لتعزيز الكوادر التشغيلية",
    ],
    opportunities: [
      "التوافق مع برامج رؤية 2030 الداعمة للقطاعات غير النفطية",
      "إمكانية الوصول إلى برامج تمويل وريادة أعمال حكومية",
    ],
    threats: [
      "المنافسة المتزايدة في نفس القطاع",
      successProbability < 50
        ? "احتمالية تأخر تحقيق نقطة التعادل المالي"
        : "تقلبات السوق العامة",
    ],
  };
}

function buildRoadmap(input: StartupAnalysisInput): RoadmapPhase[] {
  return [
    {
      title: "مرحلة الإطلاق",
      timeframe: "0-6 أشهر",
      items: [
        "إتمام التأسيس القانوني والتراخيص",
        "بناء النسخة الأولية من المنتج/الخدمة",
        "اختبار السوق مع شريحة محدودة من العملاء",
      ],
    },
    {
      title: "مرحلة النمو",
      timeframe: "6-18 شهر",
      items: [
        "توسيع قاعدة العملاء بناءً على نتائج الاختبار",
        "تأمين الجولة التمويلية الأولى",
        "بناء الفريق التشغيلي الأساسي",
      ],
    },
    {
      title: "مرحلة التوسع",
      timeframe: "18 شهر فأكثر",
      items: [
        "التوسع الجغرافي أو في خطوط منتجات جديدة",
        "تعزيز الكفاءة التشغيلية وهوامش الربح",
        "تقييم فرص شراكات استراتيجية أو تمويل نمو إضافي",
      ],
    },
  ];
}

function buildTemplateNarrative(
  input: StartupAnalysisInput,
  successProbability: number,
  feasible: boolean,
  visionScore: number
): string {
  const verdict = feasible
    ? "تشير المؤشرات الأولية إلى قابلية جيدة لنجاح الفكرة"
    : "تشير المؤشرات الأولية إلى وجود تحديات تستدعي تطوير النموذج قبل طلب التمويل";

  return `${verdict}. مشروع "${input.projectName}" في قطاع ${input.sector} يحقق نسبة نجاح أولية تقدر بـ ${successProbability}%، مع توافق مع مستهدفات رؤية 2030 بنسبة ${visionScore}%. ` +
    `بناءً على البيانات المدخلة، يوصى بمراجعة هيكل التمويل والتأكد من كفاية رأس المال قبل مرحلة التنفيذ.`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
