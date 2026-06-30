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
نسبة السيولة: ${data.ratios.liquidityRatio}
نسبة المديونية: ${data.ratios.debtRatio}
هامش الربح: ${(data.ratios.profitMargin * 100).toFixed(1)}%
احتمالية التعثر: ${data.risk.defaultProbability}%
مستوى المخاطر: ${data.risk.riskLevel}
توافق رؤية 2030: ${data.vision2030.score}%
التمويل الموصى به: ${data.funding.amount.toLocaleString("ar-SA")} ريال
نسبة الفائدة المقترحة: ${data.funding.interestRate}%
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
    `باحتمالية تعثر تقدر بـ ${data.risk.defaultProbability}%. ` +
    `تبلغ نسبة السيولة ${data.ratios.liquidityRatio} ونسبة المديونية ${data.ratios.debtRatio}، ` +
    `بهامش ربح يقارب ${(data.ratios.profitMargin * 100).toFixed(1)}%. ` +
    `يحقق النشاط توافقاً مع مستهدفات رؤية 2030 بنسبة ${data.vision2030.score}%. ` +
    `بناءً على هذه المؤشرات، يوصى بتمويل بقيمة ${data.funding.amount.toLocaleString(
      "ar-SA"
    )} ريال بفائدة ${data.funding.interestRate}%، مع التوصية التالية: ${
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
