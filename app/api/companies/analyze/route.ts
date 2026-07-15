import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import {
  FINANCIAL_FIELDS,
  CORE_FINANCIAL_FIELDS,
  BANKING_SUPPLEMENTAL_FIELDS,
  FINANCIAL_FIELD_TO_SNAKE,
  FIELD_LABELS_AR,
  mapSnakeFinancials,
  buildVerifiedRatios,
  computeRiskScore,
  computeVision2030Score,
  computeFundingRecommendation,
  getIndustryBenchmark,
  compareWithIndustry,
  translateMissingFields,
  FinancialField,
} from "@/lib/financial";
import { buildCompanyFinancingLifecycle } from "@/lib/financingLifecycle";
import { generateCompanyNarrative } from "@/lib/ai";
import { saveReport, generateUniqueReferenceNumber } from "@/lib/store";

import { CompanyImpactProfile, CompanyReportData } from "@/lib/types";
import {
  createReportAccessToken,
  REPORT_ACCESS_COOKIE,
  REPORT_ACCESS_MAX_AGE,
} from "@/lib/auth";
import { getCompanySession } from "@/lib/apiAuth";
import { extractFinancialsFromPdf } from "@/lib/financialPdfExtract";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

type EltResult = {
  status: string;
  message?: string;
  processed_file?: string;
  validation?: {
    missing_fields?: string[];
    reasons?: string[];
    [key: string]: unknown;
  };
  logic_validation?: {
    logic_valid?: boolean;
    issues?: string[];
    warnings?: string[];
  };
  cleaned_data?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  scoring?: Record<string, unknown>;
};

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function normalizeNumberInput(value: FormDataEntryValue | null): string {
  if (value === null) return "";

  let text = String(value)
    .trim()
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[−–—]/g, "-")
    .replace(/ /g, " ");

  if (!text) return "";

  let negative = false;
  if (/^\(.+\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }

  text = text.replace(/ريال|ر\.س|sar/gi, "").replace(/[,،\s]/g, "");

  if (text.endsWith("-")) {
    negative = true;
    text = text.slice(0, -1);
  }
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  }

  const numericText = `${negative ? "-" : ""}${text}`;
  const numeric = Number(numericText);
  return Number.isFinite(numeric) ? String(numeric) : String(value).trim();
}

function toNumberOrEmpty(value: FormDataEntryValue | null): string {
  if (value === null) return "";
  const normalized = normalizeNumberInput(value);
  return normalized ? normalized : "";
}

function parseManualNumber(value: FormDataEntryValue | null): number | null {
  const normalized = normalizeNumberInput(value);
  if (!normalized) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseOptionalNumber(
  formData: FormData,
  key: string,
  max?: number,
): number | null {
  const raw = formData.get(key);
  if (raw === null || !String(raw).trim()) return null;
  const value = parseManualNumber(raw);
  if (value === null || value < 0 || (max !== undefined && value > max)) {
    throw new Error(`قيمة غير صالحة للحقل ${key}`);
  }
  return value;
}

function parseImpactProfile(formData: FormData): CompanyImpactProfile | undefined {
  const profile: CompanyImpactProfile = {
    employeeCount: parseOptionalNumber(formData, "employeeCount"),
    saudiEmployeeCount: parseOptionalNumber(formData, "saudiEmployeeCount"),
    plannedNewJobs: parseOptionalNumber(formData, "plannedNewJobs"),
    localProcurementPercent: parseOptionalNumber(
      formData,
      "localProcurementPercent",
      100,
    ),
    nonOilRevenuePercent: parseOptionalNumber(
      formData,
      "nonOilRevenuePercent",
      100,
    ),
    sustainabilityScore: parseOptionalNumber(
      formData,
      "sustainabilityScore",
      100,
    ),
  };

  if (
    profile.employeeCount !== null &&
    profile.saudiEmployeeCount !== null &&
    profile.saudiEmployeeCount > profile.employeeCount
  ) {
    throw new Error(
      "عدد الموظفين السعوديين لا يمكن أن يتجاوز إجمالي الموظفين.",
    );
  }

  return Object.values(profile).some((value) => value !== null)
    ? profile
    : undefined;
}

async function runPythonPipeline(filePath: string) {
  const pythonCandidates = [process.env.PYTHON_BIN, "python", "python3"].filter(
    Boolean,
  ) as string[];

  let lastError: unknown;

  for (const pythonBin of pythonCandidates) {
    try {
      const { stdout, stderr } = await execFileAsync(
        pythonBin,
        ["-m", "src.elt.pipeline", filePath],
        {
          cwd: process.cwd(),
          maxBuffer: 1024 * 1024 * 10,
        },
      );

      if (stderr && stderr.trim()) {
        console.error("Python stderr:", stderr);
      }

      return stdout;
    } catch (error: any) {
      lastError = error;
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(
        "لم يتم العثور على Python. جرّب ضبط PYTHON_BIN أو تثبيت python/python3.",
      );
}

function analysisTempDirectory() {
  return process.env.DATABASE_URL || process.env.NODE_ENV === "production"
    ? path.join(os.tmpdir(), "financial-pulse-analysis")
    : path.join(process.cwd(), "uploads");
}

async function persistUploadedFile(file: File): Promise<string> {
  const uploadsDir = analysisTempDirectory();
  await fs.mkdir(uploadsDir, { recursive: true });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const safeName = `${Date.now()}-${sanitizeFileName(file.name)}`;
  const filePath = path.join(uploadsDir, safeName);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

async function persistFinancialPdfAsCsv(file: File): Promise<{ filePath: string; warnings: string[] }> {
  const uploadsDir = analysisTempDirectory();
  await fs.mkdir(uploadsDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length < 5 || buffer.subarray(0, 4).toString("latin1") !== "%PDF") {
    throw new Error("الملف المرفوع ليس ملف PDF صالحاً.");
  }
  const extraction = await extractFinancialsFromPdf(buffer);
  if (!extraction.recognizedFields.length) {
    throw new Error(extraction.warnings[0] || "تعذر استخراج البنود المالية من PDF. استخدم PDF نصياً أو ملف Excel.");
  }
  const headers = FINANCIAL_FIELDS.map((field) => FINANCIAL_FIELD_TO_SNAKE[field]);
  const row = headers.map((header) => csvEscape(extraction.row[header] ?? ""));
  const filePath = path.join(uploadsDir, `${Date.now()}-financial-pdf-extracted.csv`);
  await fs.writeFile(filePath, `${headers.join(",")}
${row.join(",")}
`, "utf8");
  return { filePath, warnings: extraction.warnings };
}

async function persistManualCsv(formData: FormData): Promise<string> {
  const uploadsDir = analysisTempDirectory();
  await fs.mkdir(uploadsDir, { recursive: true });

  const headers = FINANCIAL_FIELDS.map(
    (field) => FINANCIAL_FIELD_TO_SNAKE[field],
  );
  const row = FINANCIAL_FIELDS.map((field) =>
    csvEscape(toNumberOrEmpty(formData.get(field))),
  );
  const csv = `${headers.join(",")}\n${row.join(",")}\n`;
  const filePath = path.join(uploadsDir, `${Date.now()}-manual-financials.csv`);
  await fs.writeFile(filePath, csv, "utf8");
  return filePath;
}

function validateManualFields(formData: FormData) {
  const missing: FinancialField[] = [];
  const invalid: FinancialField[] = [];

  CORE_FINANCIAL_FIELDS.forEach((field) => {
    const raw = formData.get(field);
    const text = raw === null ? "" : String(raw).trim();
    if (!text) {
      missing.push(field);
      return;
    }
    const numeric = parseManualNumber(raw);
    if (numeric === null) invalid.push(field);
  });

  return { missing, invalid };
}

function parseElt(stdout: string): EltResult {
  try {
    return JSON.parse(stdout) as EltResult;
  } catch {
    throw new Error("تعذر قراءة نتيجة المعالجة من بايثون.");
  }
}

function buildErrorResponse(result: EltResult) {
  const missing = translateMissingFields(
    result.validation?.missing_fields || [],
  );
  const reasons = result.validation?.reasons || [];
  const issues = result.logic_validation?.issues || [];
  const details = [...reasons, ...issues];

  return NextResponse.json(
    {
      error:
        result.status === "invalid"
          ? "بيانات ناقصة: يجب إدخال الحقول المالية الأساسية الـ23 كاملة قبل إنشاء التحليل."
          : "توجد مشكلات منطقية في البيانات، يرجى مراجعتها قبل إنشاء الداشبورد.",
      message: result.message,
      missingFields: missing,
      details,
      validation: result.validation,
      logicValidation: result.logic_validation,
    },
    { status: 422 },
  );
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const companyName = String(formData.get("companyName") || "شركة غير مسماة");
    const sector = String(formData.get("sector") || "أخرى");
    const city = String(formData.get("city") || "");
    const sourceMethod = String(formData.get("sourceMethod") || "manual") as
      "upload" | "manual";
    const impactProfile = parseImpactProfile(formData);

    let filePath: string;
    let pdfExtractionWarnings: string[] = [];

    if (sourceMethod === "upload") {
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "يرجى رفع ملف Excel أو CSV أو PDF." },
          { status: 400 },
        );
      }
      const extension = path.extname(file.name).toLowerCase();
      if (![".xlsx", ".xls", ".csv", ".pdf"].includes(extension)) {
        return NextResponse.json(
          { error: "نوع الملف غير مدعوم. الأنواع المقبولة: Excel وCSV وPDF." },
          { status: 400 },
        );
      }
      if (extension === ".pdf") {
        const extracted = await persistFinancialPdfAsCsv(file);
        filePath = extracted.filePath;
        pdfExtractionWarnings = extracted.warnings;
      } else {
        filePath = await persistUploadedFile(file);
      }
    } else {
      const manualCheck = validateManualFields(formData);
      if (manualCheck.missing.length || manualCheck.invalid.length) {
        return NextResponse.json(
          {
            error: "بيانات ناقصة: يجب إدخال الحقول المالية الأساسية الـ23 كاملة وبقيم رقمية صحيحة.",
            missingFields: manualCheck.missing.map(
              (field) => FIELD_LABELS_AR[field],
            ),
            invalidFields: manualCheck.invalid.map(
              (field) => FIELD_LABELS_AR[field],
            ),
          },
          { status: 422 },
        );
      }
      filePath = await persistManualCsv(formData);
    }

    const stdout = await runPythonPipeline(filePath);
    const eltResult = parseElt(stdout);

    if (eltResult.status === "error") {
      return NextResponse.json(
        { error: eltResult.message || "حدث خطأ أثناء معالجة الملف." },
        { status: 500 },
      );
    }

    if (eltResult.status === "invalid") {
      return buildErrorResponse(eltResult);
    }

    // لا نرفض الملف بسبب الملاحظات المنطقية فقط؛ نعرضها داخل لوحة النتائج.
    // الرفض يكون فقط عند نقص الحقول المطلوبة أو فشل قراءة الملف.

    const cleanedData = eltResult.cleaned_data || {};
    const metrics = eltResult.metrics || {};
    const scoring = eltResult.scoring || {};

    const financials = mapSnakeFinancials(cleanedData);
    const verified = buildVerifiedRatios(financials, metrics);
    const ratios = verified.ratios;
    const risk = computeRiskScore(financials, ratios, scoring);
    const vision2030 = computeVision2030Score(
      sector,
      impactProfile?.employeeCount ?? undefined,
      ratios,
      impactProfile,
    );
    const funding = computeFundingRecommendation(
      financials,
      ratios,
      risk,
      scoring,
    );
    const financingLifecycle = buildCompanyFinancingLifecycle({
      financials,
      ratios,
      risk,
      funding,
    });
    const benchmark = getIndustryBenchmark(sector);
    const sectorComparison = compareWithIndustry(ratios, benchmark);

    const supplementalProvided = BANKING_SUPPLEMENTAL_FIELDS.filter(
      (field) => financials[field] !== null && financials[field] !== undefined,
    );
    const supplementalMissing = BANKING_SUPPLEMENTAL_FIELDS.filter(
      (field) => financials[field] === null || financials[field] === undefined,
    );
    const visionMissingInputs = vision2030.details?.missingInputs || [];
    const dataSufficiency = {
      coreFinancials: {
        requiredCount: 23 as const,
        complete: true,
        missingFields: [] as string[],
        status: "complete" as const,
        note: "تم التحقق من اكتمال الحقول المالية الأساسية الـ23 الإلزامية.",
      },
      supplemental: {
        providedFields: supplementalProvided.map((field) => FIELD_LABELS_AR[field]),
        missingFields: supplementalMissing.map((field) => FIELD_LABELS_AR[field]),
        status: supplementalMissing.length === 0
          ? ("complete" as const)
          : supplementalProvided.length === 0
            ? ("not_provided" as const)
            : ("partial" as const),
        note: supplementalMissing.length === 0
          ? "البيانات المصرفية الإضافية مكتملة."
          : "أي تحليل يعتمد على بيانات خارج الحقول الأساسية الـ23 هو افتراضي أو غير دقيق بالكامل لعدم توفر بيانات كافية.",
      },
      vision2030: {
        isEstimated: Boolean(vision2030.details?.isEstimated),
        missingInputs: visionMissingInputs,
        note: vision2030.details?.note || "",
      },
      altman: {
        isAccurate: ratios.altmanModel === "private_full" && ratios.zScore !== null,
        missingInputs: ratios.altmanModel === "private_full" ? [] : ["الأرباح المبقاة"],
        note: ratios.altmanModel === "private_full"
          ? "Altman Z' محسوب بالنموذج الكامل للشركات الخاصة."
          : "Altman Z' غير متاح أو غير دقيق لعدم وجود الأرباح المبقاة ضمن البيانات المرفوعة.",
      },
    };

    const companySession = getCompanySession(req);
    const reportBase: Omit<CompanyReportData, "narrative"> = {
      _accessControl: companySession
        ? { ownerCompanyId: companySession.companyId }
        : undefined,
      companyName,
      sector,
      city,
      financials,
      impactProfile,
      ratios,
      risk,
      vision2030,
      funding,
      financingLifecycle,
      benchmark,
      sectorComparison,
      analysisAudit: verified.audit,
      dataSufficiency,
      elt: {
        status: eltResult.status,
        message: eltResult.message || "تمت معالجة البيانات والتحقق منها بنجاح.",
        validation: eltResult.validation,
        logicValidation: eltResult.logic_validation,
        processedFile: eltResult.processed_file,
      },
    };

    const narrative = await generateCompanyNarrative(reportBase);
    const reportData: CompanyReportData = {
      ...reportBase,
      narrative,
      referenceNumber: await generateUniqueReferenceNumber(),
    };
    const id = await saveReport("company", reportData);

    const response = NextResponse.json(
      {
        id,
        status: eltResult.status,
        warnings: [
          ...(eltResult.logic_validation?.warnings || []),
          ...pdfExtractionWarnings,
        ],
        pdfExtractionWarnings,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(REPORT_ACCESS_COOKIE, createReportAccessToken(id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: REPORT_ACCESS_MAX_AGE,
    });
    return response;
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      {
        error: err?.message || "تعذر معالجة البيانات. يرجى المحاولة مرة أخرى.",
        details: err?.message || String(err),
      },
      { status: 400 },
    );
  }
}
