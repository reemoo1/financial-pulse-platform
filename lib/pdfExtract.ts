import { inflateSync } from "zlib";

export interface FinancingPdfExtraction {
  contactName?: string;
  phone?: string;
  email?: string;
  requestedAmount?: number;
  purpose?: string;
  termMonths?: number;
  notes?: string;
  rawText?: string;
  warnings: string[];
}

const FIELD_PATTERNS: Record<keyof Omit<FinancingPdfExtraction, "rawText" | "warnings" | "requestedAmount" | "termMonths">, RegExp[]> = {
  contactName: [
    /(?:اسم\s*(?:الشخص\s*)?(?:المسؤول|المفوض|ممثل\s*الشركة)|contact\s*name|responsible\s*person)\s*[:：\-]?\s*([^\n\r]+)/i,
  ],
  phone: [
    /(?:رقم\s*(?:الجوال|الهاتف)|الجوال|الهاتف|mobile|phone)\s*[:：\-]?\s*([+\d\s()\-]{7,})/i,
  ],
  email: [
    /(?:البريد\s*الإلكتروني|الايميل|email)\s*[:：\-]?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
    /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
  ],
  purpose: [
    /(?:الغرض\s*من\s*التمويل|Purpose|financing\s*purpose)\s*[:：\-]?\s*([^\n\r]+)/i,
  ],
  notes: [
    /(?:ملاحظات|notes)\s*[:：\-]?\s*([^\n\r]+)/i,
  ],
};

const NUMERIC_PATTERNS = {
  requestedAmount: [
    /(?:المبلغ\s*المطلوب|قيمة\s*التمويل|requested\s*amount|loan\s*amount)\s*[:：\-]?\s*([\d,\.\s]+)\s*(?:ريال|SAR|SR)?/i,
  ],
  termMonths: [
    /(?:مدة\s*السداد|المدة|term|tenor)\s*[:：\-]?\s*(\d{1,3})\s*(?:شهر|شهراً|months?)/i,
  ],
};

/**
 * Primary text-layer extraction via pdfjs-dist (handles real-world PDFs:
 * font subsets, hex strings, CID encodings, Arabic text). The lightweight
 * zlib-based parser below remains as a fallback if pdfjs fails.
 */
async function extractTextWithPdfjs(buffer: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;

  const MAX_PAGES = 20;
  const pages: string[] = [];
  const pageCount = Math.min(doc.numPages, MAX_PAGES);
  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let pageText = "";
    for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
      if (typeof item.str === "string") pageText += item.str;
      if (item.hasEOL) pageText += "\n";
    }
    pages.push(pageText);
  }
  await doc.destroy();
  return pages.join("\n");
}

export async function extractFinancingFieldsFromPdf(
  buffer: Buffer
): Promise<FinancingPdfExtraction> {
  let text = "";
  try {
    text = await extractTextWithPdfjs(buffer);
  } catch {
    // pdfjs could not parse the file — fall back to the lightweight parser.
  }
  if (!text.trim()) {
    text = extractTextFromPdfBuffer(buffer);
  }
  const normalized = normalizeText(text);
  const result: FinancingPdfExtraction = { warnings: [], rawText: normalized.slice(0, 5000) };

  for (const [field, patterns] of Object.entries(FIELD_PATTERNS) as [
    keyof typeof FIELD_PATTERNS,
    RegExp[]
  ][]) {
    const value = firstMatch(normalized, patterns);
    if (value) result[field] = cleanFieldValue(value);
  }

  const amount = firstMatch(normalized, NUMERIC_PATTERNS.requestedAmount);
  if (amount) result.requestedAmount = parseNumber(amount);

  const term = firstMatch(normalized, NUMERIC_PATTERNS.termMonths);
  if (term) result.termMonths = Number(term.replace(/\D/g, ""));

  const extractedKeys = [
    "contactName",
    "phone",
    "email",
    "requestedAmount",
    "purpose",
    "termMonths",
    "notes",
  ].filter((key) => (result as any)[key] !== undefined);

  if (!normalized.trim()) {
    result.warnings.push("لم يتم العثور على نص قابل للاستخراج داخل ملف PDF. قد يكون الملف صورة ممسوحة ضوئياً.");
  } else if (extractedKeys.length === 0) {
    result.warnings.push("تمت قراءة ملف PDF لكن لم يتم العثور على حقول مطابقة تلقائياً.");
  }

  return result;
}

function extractTextFromPdfBuffer(buffer: Buffer): string {
  const latin = buffer.toString("latin1");
  const chunks: string[] = [];

  const streamRegex = /<<(.*?)>>\s*stream\r?\n?([\s\S]*?)\r?\n?endstream/g;
  let streamMatch: RegExpExecArray | null;
  while ((streamMatch = streamRegex.exec(latin))) {
    const dict = streamMatch[1];
    let streamBuffer = Buffer.from(streamMatch[2], "latin1");
    if (/\/FlateDecode/.test(dict)) {
      try {
        streamBuffer = inflateSync(streamBuffer);
      } catch {
        continue;
      }
    }
    chunks.push(extractTextOperators(streamBuffer.toString("latin1")));
  }

  if (chunks.join(" ").trim()) return chunks.join("\n");
  return extractTextOperators(latin);
}

function extractTextOperators(input: string): string {
  const chunks: string[] = [];

  const literalRegex = /\((?:\\.|[^\\()])*\)\s*Tj/g;
  let literalMatch: RegExpExecArray | null;
  while ((literalMatch = literalRegex.exec(input))) {
    chunks.push(decodePdfLiteral(literalMatch[0].replace(/\)\s*Tj$/, ")")));
  }

  const arrayRegex = /\[((?:\s*\((?:\\.|[^\\()])*\)\s*-?\d*\.?\d*)+)\]\s*TJ/g;
  let arrayMatch: RegExpExecArray | null;
  while ((arrayMatch = arrayRegex.exec(input))) {
    const part = arrayMatch[1];
    const values = part.match(/\((?:\\.|[^\\()])*\)/g) || [];
    chunks.push(values.map(decodePdfLiteral).join(""));
  }

  return chunks.join("\n");
}

function decodePdfLiteral(value: string): string {
  let content = value;
  if (content.startsWith("(") && content.endsWith(")")) {
    content = content.slice(1, -1);
  }
  return content
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));
}

function normalizeText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return "";
}

function cleanFieldValue(value: string) {
  return value.replace(/[|؛]+$/g, "").trim().slice(0, 400);
}

function parseNumber(value: string) {
  const cleaned = value.replace(/,/g, "").replace(/\s/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : undefined;
}
