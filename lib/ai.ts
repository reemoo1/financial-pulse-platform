// AI narrative generation.
//
// If OPENAI_API_KEY is set in the environment, this calls the OpenAI API to
// produce a polished Arabic narrative summary from the structured financial
// data (numbers are computed deterministically by lib/financial.ts and only
// passed to the model for narration — the model never invents figures).
//
// If no API key is set, a deterministic Arabic template is used instead so
// the whole project runs fully offline with zero configuration.

import { CompanyReportData } from "./types";

export async function generateCompanyNarrative(
  data: Omit<CompanyReportData, "narrative">
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey) {
    try {
      return await callOpenAI(apiKey, buildCompanyPrompt(data));
    } catch (err) {
      console.error("OpenAI call failed, falling back to template:", err);
    }
  }

  return buildCompanyTemplateNarrative(data);
}

function buildCompanyPrompt(data: Omit<CompanyReportData, "narrative">): string {
  return `أنت محلل ائتماني خبير في بنك سعودي. بناءً على البيانات التالية، اكتب ملخصاً تنفيذياً موجزاً (4-6 جمل) باللغة العربية الفصحى يشرح الوضع المالي للشركة ومستوى المخاطر والتوصية. لا تخترع أي أرقام غير المذكورة أدناه.

اسم الشركة: ${data.companyName}
القطاع: ${data.sector}
نسبة السيولة: ${formatTimes(data.ratios.currentRatio)}
نسبة المديونية: ${formatPercent(data.ratios.debtRatio)}
هامش الربح: ${formatPercent(data.ratios.netProfitMargin)}
درجة الصحة المالية: ${data.risk.healthScore ?? 100 - data.risk.defaultProbability} من 100
احتمال التعثر التقديري خلال 12 شهراً: ${formatProbability(data.risk.defaultProbability)}
مستوى المخاطر: ${data.risk.riskLevel}
توافق رؤية 2030: ${data.vision2030.score}%
جودة بيانات أثر رؤية 2030: ${data.vision2030.details?.dataQuality ?? 0}%
التمويل الموصى به: ${data.funding.amount.toLocaleString("ar-SA")} ريال
نسبة الفائدة المقترحة: ${data.funding.interestRate}%
القيد المحدد لمبلغ التمويل: ${data.funding.calculation?.bindingConstraint ?? "غير متوفر"}
DSCR المستهدف: ${formatTimes(data.funding.calculation?.targetDscr)}
التوصية: ${data.funding.recommendationText}`;
}

function buildCompanyTemplateNarrative(
  data: Omit<CompanyReportData, "narrative">
): string {
  const riskLabel =
    data.risk.riskLevel === "low"
      ? "منخفض"
      : data.risk.riskLevel === "medium"
      ? "متوسط"
      : "مرتفع";

  return (
    `تُظهر البيانات المالية لشركة "${data.companyName}" العاملة في قطاع ${data.sector} مستوى مخاطر ${riskLabel} ` +
    `بدرجة صحة مالية تبلغ ${data.risk.healthScore ?? 100 - data.risk.defaultProbability} من 100. ` +
    `ويبلغ احتمال التعثر التقديري خلال 12 شهراً ${formatProbability(data.risk.defaultProbability)} وفق نموذج دعم القرار المالي. ` +
    `تبلغ نسبة السيولة ${formatTimes(data.ratios.currentRatio)} ونسبة المديونية ${formatPercent(data.ratios.debtRatio)}، ` +
    `بهامش ربح يقارب ${formatPercent(data.ratios.netProfitMargin)}. ` +
    `يحقق النشاط توافقاً مع مستهدفات رؤية 2030 بنسبة ${data.vision2030.score}%، بجودة بيانات فعلية تبلغ ${data.vision2030.details?.dataQuality ?? 0}%. ` +
    `بناءً على هذه المؤشرات، يوصى بتمويل بقيمة ${data.funding.amount.toLocaleString(
      "ar-SA"
    )} ريال بفائدة ${data.funding.interestRate}%، ويُحدد المبلغ بواسطة ${
      data.funding.calculation?.bindingConstraint ?? "أدنى حدود القدرة المتاحة"
    }. التوصية: ${
      data.funding.recommendationText
    }.`
  );
}

async function callOpenAI(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const json = await response.json();
  const text = json?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty OpenAI response");
  return text.trim();
}


function formatTimes(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "غير متوفر";
  return `${value.toLocaleString("ar-SA", { maximumFractionDigits: 2 })} مرة`;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "غير متوفر";
  return `${(value * 100).toLocaleString("ar-SA", { maximumFractionDigits: 1 })}%`;
}

function formatProbability(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "غير متوفر";
  return `${value.toLocaleString("ar-SA", { maximumFractionDigits: 1 })}%`;
}
