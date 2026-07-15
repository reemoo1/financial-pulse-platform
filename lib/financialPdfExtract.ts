import {
  FIELD_LABELS_AR,
  FINANCIAL_FIELDS,
  FINANCIAL_FIELD_TO_SNAKE,
  FinancialField,
} from "./financial";

const EXTRA_ALIASES: Partial<Record<FinancialField, string[]>> = {
  totalAssets: ["total assets", "assets total", "مجموع الأصول"],
  currentAssets: ["current assets", "الأصول الحالية"],
  cash: ["cash and cash equivalents", "cash", "النقدية", "النقد وما في حكمه"],
  inventory: ["inventory", "المخزون السلعي"],
  accountsReceivable: ["accounts receivable", "trade receivables", "الذمم المدينة", "المدينون"],
  totalLiabilities: ["total liabilities", "مجموع الالتزامات", "إجمالي الخصوم"],
  currentLiabilities: ["current liabilities", "الخصوم المتداولة"],
  shortTermDebt: ["short term debt", "short-term debt", "قروض قصيرة الأجل"],
  longTermDebt: ["long term debt", "long-term debt", "قروض طويلة الأجل"],
  equity: ["equity", "shareholders equity", "حقوق المساهمين"],
  retainedEarnings: ["retained earnings", "أرباح مبقاة"],
  revenue: ["revenue", "sales", "المبيعات", "إجمالي الإيرادات"],
  costOfGoodsSold: ["cost of goods sold", "cost of sales", "تكلفة الإيرادات"],
  grossProfit: ["gross profit", "إجمالي الربح"],
  operatingExpenses: ["operating expenses", "المصروفات التشغيلية"],
  operatingIncome: ["operating income", "operating profit", "ebit", "الربح من العمليات"],
  netIncome: ["net income", "net profit", "صافي الدخل"],
  interestExpense: ["interest expense", "finance cost", "تكاليف التمويل", "مصاريف التمويل"],
  zakatTax: ["zakat and tax", "zakat tax", "الزكاة والضرائب"],
  depreciation: ["depreciation", "الإهلاكات"],
  amortization: ["amortization", "الإطفاء"],
  operatingCashFlow: ["operating cash flow", "cash from operations", "صافي النقد من الأنشطة التشغيلية"],
  investingCashFlow: ["investing cash flow", "cash from investing", "صافي النقد من الأنشطة الاستثمارية"],
  financingCashFlow: ["financing cash flow", "cash from financing", "صافي النقد من الأنشطة التمويلية"],
  netCashFlow: ["net cash flow", "net change in cash", "صافي التغير في النقد"],
  endingCashBalance: ["ending cash balance", "cash at end of period", "النقد في نهاية الفترة"],
  cfads: ["cfads", "cash flow available for debt service", "النقد المتاح لخدمة الدين"],
  maintenanceCapex: ["maintenance capex", "maintenance capital expenditure", "النفقات الرأسمالية الضرورية"],
  scheduledPrincipal: ["scheduled principal", "principal due", "أصل الدين المستحق"],
  scheduledInterest: ["scheduled interest", "interest due", "الفوائد المستحقة"],
  mandatoryDebtFees: ["mandatory debt fees", "debt service fees", "رسوم الدين الإلزامية"],
  financeLeasePayments: ["finance lease payments", "lease payments", "دفعات عقود الإيجار التمويلي"],
};

export type FinancialPdfExtraction = {
  row: Record<string, number>;
  recognizedFields: FinancialField[];
  warnings: string[];
  rawText: string;
};

export async function extractFinancialsFromPdf(buffer: Buffer): Promise<FinancialPdfExtraction> {
  const warnings: string[] = [];
  let rawText = "";
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      isEvalSupported: false,
    }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= Math.min(doc.numPages, 40); pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      let pageText = "";
      for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
        if (typeof item.str === "string") pageText += `${item.str} `;
        if (item.hasEOL) pageText += "\n";
      }
      pages.push(pageText);
    }
    rawText = pages.join("\n");
    await doc.destroy();
  } catch (error) {
    warnings.push(error instanceof Error ? `تعذر قراءة طبقة النص في PDF: ${error.message}` : "تعذر قراءة طبقة النص في PDF.");
  }

  const normalized = normalizeText(rawText);
  if (!normalized.trim()) {
    warnings.push("ملف PDF لا يحتوي على نص قابل للاستخراج. إذا كان ممسوحاً ضوئياً، استخدم PDF نصي أو Excel.");
    return { row: {}, recognizedFields: [], warnings, rawText: "" };
  }

  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const row: Record<string, number> = {};
  const recognizedFields: FinancialField[] = [];

  for (const field of FINANCIAL_FIELDS) {
    const aliases = [
      FIELD_LABELS_AR[field],
      FINANCIAL_FIELD_TO_SNAKE[field],
      field,
      ...(EXTRA_ALIASES[field] || []),
    ].map(normalizeLabel);

    let value: number | null = null;
    for (let index = 0; index < lines.length && value === null; index += 1) {
      const normalizedLine = normalizeLabel(lines[index]);
      const matchedAlias = aliases.find((alias) => alias && normalizedLine.includes(alias));
      if (!matchedAlias) continue;

      const sameLine = numbersFromText(lines[index]);
      if (sameLine.length) {
        value = sameLine[sameLine.length - 1];
        break;
      }

      const nextLine = lines[index + 1] ? numbersFromText(lines[index + 1]) : [];
      if (nextLine.length) value = nextLine[nextLine.length - 1];
    }

    if (value !== null && Number.isFinite(value)) {
      row[FINANCIAL_FIELD_TO_SNAKE[field]] = value;
      recognizedFields.push(field);
    }
  }

  if (!recognizedFields.length) warnings.push("تمت قراءة PDF، لكن لم تُكتشف بنود مالية معروفة تلقائياً.");
  return { row, recognizedFields, warnings, rawText: normalized.slice(0, 12000) };
}

function normalizeText(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

function normalizeLabel(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[ـًٌٍَُِّْ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[_/\\:()\-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numbersFromText(value: string): number[] {
  const candidates = normalizeText(value).match(/\(?-?\d[\d,،\s]*(?:\.\d+)?\)?-?/g) || [];
  return candidates
    .map((candidate) => {
      let text = candidate.trim().replace(/[,،\s]/g, "");
      let negative = false;
      if (text.startsWith("(") && text.endsWith(")")) {
        negative = true;
        text = text.slice(1, -1);
      }
      if (text.endsWith("-")) {
        negative = true;
        text = text.slice(0, -1);
      }
      if (text.startsWith("-")) {
        negative = true;
        text = text.slice(1);
      }
      const number = Number(text);
      return Number.isFinite(number) ? (negative ? -number : number) : Number.NaN;
    })
    .filter((number) => Number.isFinite(number));
}
