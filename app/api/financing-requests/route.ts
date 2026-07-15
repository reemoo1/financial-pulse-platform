import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  getReport,
  saveFinancingRequest,
  updateFinancingRequestEmailDelivery,
  isFinancingRequestReferenceNumberTaken,
  generateUniqueReferenceNumber,
  getCompanyUserByCR,
} from "@/lib/store";
import { getPartnerBankQuote } from "@/lib/banks";
import { normalizeCompanyReportData } from "@/lib/financial";
import {
  buildCompanyFinancingLifecycle,
  buildStartupFinancingLifecycle,
} from "@/lib/financingLifecycle";
import { generateOtp, hashOtp } from "@/lib/otp";
import { saveUploadedFile, validateAttachmentCount } from "@/lib/fileUpload";
import { sendTicketEmail, EmailAttachment } from "@/lib/email";
import { canReadReport, getCompanySession } from "@/lib/apiAuth";
import { isValidEmail, isValidSaudiPhone } from "@/lib/validation";
import {
  CompanyReportData,
  StartupReportData,
  FinancingRequestInput,
  FinancingRequestRecord,
  FinancingRequestFile,
} from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    const parsed = contentType.includes("multipart/form-data")
      ? await parseMultipartRequest(req)
      : await parseJsonRequest(req);

    const {
      reportId,
      contactName,
      phone,
      email,
      requestedAmount,
      purpose,
      termMonths,
      notes,
      crNumber,
      detailedActivity,
      establishmentDate,
      companyAgeYears,
      ownerName,
      ownerNationalId,
    } = parsed.input;

    if (
      !reportId ||
      !contactName?.trim() ||
      !phone?.trim() ||
      !requestedAmount ||
      !String(crNumber || "").trim() ||
      !String(detailedActivity || "").trim() ||
      !String(establishmentDate || "").trim() ||
      !String(ownerName || "").trim() ||
      !String(ownerNationalId || "").trim()
    ) {
      return NextResponse.json(
        { error: "الحقول المطلوبة غير مكتملة" },
        { status: 400 },
      );
    }

    if (parsed.submissionMode === "pdf" && !parsed.companyPdf) {
      return NextResponse.json(
        { error: "يرجى رفع ملف PDF لمعلومات الشركة أو اختيار الإدخال اليدوي" },
        { status: 400 },
      );
    }

    const missingRequiredDocuments = parsed.documentFiles
      .filter((item) => item.required && !item.file)
      .map((item) => item.label);
    if (missingRequiredDocuments.length) {
      return NextResponse.json(
        { error: `المستندات الإلزامية غير مكتملة: ${missingRequiredDocuments.join("، ")}` },
        { status: 400 },
      );
    }
    if (!/^\d{10}$/.test(String(ownerNationalId || "").trim())) {
      return NextResponse.json(
        { error: "رقم هوية مالك الشركة أو المفوض يجب أن يتكون من 10 أرقام" },
        { status: 400 },
      );
    }

    if (!isValidSaudiPhone(phone)) {
      return NextResponse.json(
        { error: "يرجى إدخال رقم جوال سعودي صحيح" },
        { status: 400 },
      );
    }
    if (email && !isValidEmail(email)) {
      return NextResponse.json(
        { error: "يرجى إدخال بريد إلكتروني صحيح" },
        { status: 400 },
      );
    }
    if (Number(requestedAmount) <= 0 || Number(termMonths) < 1 || Number(termMonths) > 120) {
      return NextResponse.json(
        { error: "مبلغ التمويل أو مدة السداد غير صالحة" },
        { status: 400 },
      );
    }
    const report = await getReport(reportId);
    if (!report) {
      return NextResponse.json({ error: "التقرير غير موجود" }, { status: 404 });
    }
    if (!canReadReport(req, reportId, report.data._accessControl?.ownerCompanyId)) {
      return NextResponse.json(
        { error: "لا توجد صلاحية للوصول إلى التقرير" },
        { status: 401 },
      );
    }

    let applicantName: string;
    let sector: string;
    let riskLevel: "low" | "medium" | "high";
    let lifecycleInputReport: CompanyReportData | StartupReportData;
    let analyzedRate: number | null = null;
    let recommendedAmount: number | null = null;

    if (report.type === "company") {
      const d = normalizeCompanyReportData(report.data as CompanyReportData);
      applicantName = d.companyName;
      sector = d.sector;
      riskLevel = d.risk.riskLevel;
      lifecycleInputReport = d;
      analyzedRate = d.funding.interestRate;
      recommendedAmount = d.funding.amount;
    } else {
      const d = report.data as StartupReportData;
      applicantName = d.input.projectName;
      sector = d.input.sector;
      riskLevel =
        d.successProbability >= 65
          ? "low"
          : d.successProbability >= 45
            ? "medium"
            : "high";
      lifecycleInputReport = d;
    }

    const ticketId = randomUUID();
    const reportReferenceNumber = (
      report.data as CompanyReportData | StartupReportData
    ).referenceNumber;
    const referenceNumber =
      reportReferenceNumber &&
      !(await isFinancingRequestReferenceNumberTaken(reportReferenceNumber))
        ? reportReferenceNumber
        : await generateUniqueReferenceNumber();
    const submittedAt = new Date().toISOString();
    const otpExpiresAt = new Date(
      Date.now() + Number(process.env.OTP_TTL_MINUTES || 30) * 60_000,
    ).toISOString();
    const companySession = getCompanySession(req);
    const companyUser = companySession ? await getCompanyUserByCR(companySession.crNumber) : null;
    const bankQuote = getPartnerBankQuote({
      riskLevel,
      loanAmount: Number(requestedAmount),
      analyzedRate,
      recommendedAmount,
      termMonths: Number(termMonths),
    });
    const uploadedFiles: FinancingRequestFile[] = [];
    const emailAttachments: EmailAttachment[] = [];

    if (parsed.companyPdf) {
      const saved = await saveUploadedFile(
        ticketId,
        parsed.companyPdf,
        "company_pdf",
      );
      uploadedFiles.push({
        ...saved.metadata,
        documentType: "company_profile",
        displayLabel: "ملف معلومات الشركة",
        required: false,
        verificationStatus: "pending",
      });
      emailAttachments.push({
        filename: saved.metadata.originalName,
        contentType: saved.metadata.mimeType,
        content: saved.buffer,
      });
    }

    const submittedDocuments = parsed.documentFiles.filter((item) => item.file);
    validateAttachmentCount([...submittedDocuments.map((item) => item.file!), ...parsed.attachments]);
    for (const document of submittedDocuments) {
      const saved = await saveUploadedFile(ticketId, document.file!, "attachment");
      uploadedFiles.push({
        ...saved.metadata,
        documentType: document.type,
        displayLabel: document.label,
        required: document.required,
        verificationStatus: "pending",
      });
      emailAttachments.push({
        filename: saved.metadata.originalName,
        contentType: saved.metadata.mimeType,
        content: saved.buffer,
      });
    }

    validateAttachmentCount(parsed.attachments);
    for (const attachment of parsed.attachments) {
      const saved = await saveUploadedFile(ticketId, attachment, "attachment");
      uploadedFiles.push(saved.metadata);
      emailAttachments.push({
        filename: saved.metadata.originalName,
        contentType: saved.metadata.mimeType,
        content: saved.buffer,
      });
    }

    const otp = generateOtp();
    const { salt, hash } = hashOtp(otp);

    const input: FinancingRequestInput = {
      reportId,
      contactName: contactName.trim(),
      phone: phone.trim(),
      email: email?.trim() || "",
      requestedAmount: Number(requestedAmount),
      purpose: purpose || "",
      termMonths: Number(termMonths) || 12,
      notes: notes || "",
      crNumber: String(companyUser?.crNumber || crNumber || "").trim(),
      detailedActivity: String(companyUser?.detailedActivity || detailedActivity || "").trim(),
      establishmentDate: String(companyUser?.establishmentDate || establishmentDate || "").trim(),
      companyAgeYears: Math.max(0, Number(companyUser?.companyAgeYears ?? companyAgeYears ?? 0)),
      ownerName: String(ownerName || "").trim(),
      ownerNationalId: String(ownerNationalId || "").trim(),
    };

    const lifecycle =
      report.type === "company"
        ? buildCompanyFinancingLifecycle(
            lifecycleInputReport as CompanyReportData,
            "bank_review",
            input,
          )
        : buildStartupFinancingLifecycle(
            lifecycleInputReport as StartupReportData,
            "bank_review",
            input,
          );

    const record: FinancingRequestRecord = {
      input,
      ownerCompanyId: companySession?.companyId,
      referenceNumber,
      applicantName,
      applicantType: report.type,
      sector,
      companyProfile: {
        crNumber: input.crNumber || "",
        detailedActivity: input.detailedActivity || "",
        establishmentDate: input.establishmentDate,
        companyAgeYears: Number(input.companyAgeYears || 0),
        city: companyUser?.city || (report.type === "company" ? (lifecycleInputReport as CompanyReportData).city : (lifecycleInputReport as StartupReportData).input.city),
      },
      bankQuote,
      status: "bank_review",
      lifecycle,
      uploadedFiles,
      security: {
        otpSalt: salt,
        otpHash: hash,
        otpCreatedAt: submittedAt,
        otpExpiresAt,
        otpAttemptCount: 0,
        otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 3),
      },
      history: [
        {
          status: "bank_review",
          note: "تم استلام طلب التمويل وإرساله للمراجعة البنكية",
          updatedAt: submittedAt,
          actor: "system",
        },
      ],
      metadata: {
        ticketNumber: referenceNumber,
        inquiryNumber: referenceNumber,
        submissionDate: submittedAt,
        lastUpdate: submittedAt,
        submissionMode: parsed.submissionMode,
        pdfExtractionWarnings: parsed.pdfExtractionWarnings,
      },
    };

    const id = await saveFinancingRequest(record, ticketId);

    const emailDelivery = await sendTicketEmail({
      subject: `طلب تمويل جديد - رقم المعاملة ${referenceNumber}`,
      text: buildProviderEmailText({
        ticketId: referenceNumber,
        applicantName,
        sector,
        input,
        bankName: bankQuote.bank.name,
      }),
      attachments: emailAttachments,
    });
    await updateFinancingRequestEmailDelivery(id, emailDelivery);

    let otpEmailDelivery: Awaited<ReturnType<typeof sendTicketEmail>> | null = null;
    if (input.email) {
      otpEmailDelivery = await sendTicketEmail({
        to: input.email,
        subject: `رمز التحقق للاستعلام عن طلب التمويل — ${referenceNumber}`,
        text: [
          `رمز التحقق الخاص بك هو: ${otp}`,
          "",
          `صالح لمدة ${Number(process.env.OTP_TTL_MINUTES || 30)} دقيقة.`,
          "لا تشارك هذا الرمز مع أي شخص.",
          "",
          `رقم المعاملة: ${referenceNumber}`,
        ].join("\n"),
      });
    }

    return NextResponse.json(
      {
        id,
        ticketNumber: referenceNumber,
        inquiryNumber: referenceNumber,
        referenceNumber,
        otpSentToEmail: Boolean(input.email),
        otpEmailDelivery,
        bankQuote,
        lifecycle,
        emailDelivery,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      {
        error:
          err?.message || "تعذر إرسال طلب التمويل. يرجى المحاولة مرة أخرى.",
      },
      { status: 500 },
    );
  }
}

type ApplicationDocumentUpload = {
  field: string;
  type: "bank_statement_6m" | "commercial_registration" | "authorized_signatory_id" | "fund_use_plan" | "feasibility_study";
  label: string;
  required: boolean;
  file: File | null;
};

function documentFromForm(
  formData: FormData,
  field: string,
  type: ApplicationDocumentUpload["type"],
  label: string,
  required: boolean,
): ApplicationDocumentUpload {
  const value = formData.get(field);
  return { field, type, label, required, file: value instanceof File && value.name ? value : null };
}

async function parseJsonRequest(req: NextRequest): Promise<{
  input: FinancingRequestInput;
  submissionMode: "manual";
  companyPdf: File | null;
  attachments: File[];
  documentFiles: ApplicationDocumentUpload[];
  pdfExtractionWarnings: string[];
}> {
  const body = (await req.json()) as FinancingRequestInput;
  return {
    input: {
      reportId: String(body.reportId || ""),
      contactName: String(body.contactName || ""),
      phone: String(body.phone || ""),
      email: String(body.email || ""),
      requestedAmount: Number(body.requestedAmount || 0),
      purpose: String(body.purpose || ""),
      termMonths: Number(body.termMonths || 12),
      notes: String(body.notes || ""),
      crNumber: String(body.crNumber || ""),
      detailedActivity: String(body.detailedActivity || ""),
      establishmentDate: String(body.establishmentDate || ""),
      companyAgeYears: Number(body.companyAgeYears || 0),
      ownerName: String(body.ownerName || ""),
      ownerNationalId: String(body.ownerNationalId || ""),
    },
    submissionMode: "manual",
    companyPdf: null,
    attachments: [],
    // JSON cannot carry the mandatory files. Keep the required document
    // descriptors so the common validation rejects incomplete API requests.
    documentFiles: [
      { field: "bankStatementFile", type: "bank_statement_6m", label: "كشف الحساب البنكي لآخر 6 أشهر", required: true, file: null },
      { field: "commercialRegistrationFile", type: "commercial_registration", label: "مستند السجل التجاري", required: true, file: null },
      { field: "ownerIdentityFile", type: "authorized_signatory_id", label: "هوية مالك الشركة أو المفوض بالتوقيع", required: true, file: null },
    ],
    pdfExtractionWarnings: [],
  };
}

async function parseMultipartRequest(req: NextRequest): Promise<{
  input: FinancingRequestInput;
  submissionMode: "pdf" | "manual";
  companyPdf: File | null;
  attachments: File[];
  documentFiles: ApplicationDocumentUpload[];
  pdfExtractionWarnings: string[];
}> {
  const formData = await req.formData();
  const submissionMode =
    String(formData.get("submissionMode") || "manual") === "pdf"
      ? "pdf"
      : "manual";
  const companyPdf = formData.get("companyPdf");
  const attachments = formData
    .getAll("attachments")
    .filter((item): item is File => item instanceof File && !!item.name);
  const documentFiles: ApplicationDocumentUpload[] = [
    documentFromForm(formData, "bankStatementFile", "bank_statement_6m", "كشف الحساب البنكي لآخر 6 أشهر", true),
    documentFromForm(formData, "commercialRegistrationFile", "commercial_registration", "مستند السجل التجاري", true),
    documentFromForm(formData, "ownerIdentityFile", "authorized_signatory_id", "هوية مالك الشركة أو المفوض بالتوقيع", true),
    documentFromForm(formData, "fundUsePlanFile", "fund_use_plan", "خطة استخدام مبلغ التمويل", false),
    documentFromForm(formData, "feasibilityStudyFile", "feasibility_study", "دراسة الجدوى", false),
  ];

  return {
    input: {
      reportId: String(formData.get("reportId") || ""),
      contactName: String(formData.get("contactName") || ""),
      phone: String(formData.get("phone") || ""),
      email: String(formData.get("email") || ""),
      requestedAmount: Number(formData.get("requestedAmount") || 0),
      purpose: String(formData.get("purpose") || ""),
      termMonths: Number(formData.get("termMonths") || 12),
      notes: String(formData.get("notes") || ""),
      crNumber: String(formData.get("crNumber") || ""),
      detailedActivity: String(formData.get("detailedActivity") || ""),
      establishmentDate: String(formData.get("establishmentDate") || ""),
      companyAgeYears: Number(formData.get("companyAgeYears") || 0),
      ownerName: String(formData.get("ownerName") || ""),
      ownerNationalId: String(formData.get("ownerNationalId") || ""),
    },
    submissionMode,
    companyPdf:
      companyPdf instanceof File && companyPdf.name ? companyPdf : null,
    attachments,
    documentFiles,
    pdfExtractionWarnings: String(formData.get("pdfExtractionWarnings") || "")
      .split("|")
      .map((warning) => warning.trim())
      .filter(Boolean),
  };
}

function buildProviderEmailText(input: {
  ticketId: string;
  applicantName: string;
  sector: string;
  input: FinancingRequestInput;
  bankName: string;
}) {
  return [
    "تم استلام طلب تمويل جديد من منصة النبض المالي.",
    "",
    `رقم التذكرة / رقم الاستعلام: ${input.ticketId}`,
    `جهة التمويل: ${input.bankName}`,
    "",
    "معلومات العميل:",
    `- الاسم/الشركة: ${input.applicantName}`,
    `- القطاع: ${input.sector}`,
    `- رقم السجل التجاري: ${input.input.crNumber || "غير مدخل"}`,
    `- مالك الشركة/المفوض: ${input.input.ownerName || "غير مدخل"}`,
    `- اسم المسؤول: ${input.input.contactName}`,
    `- رقم الجوال: ${input.input.phone}`,
    `- البريد الإلكتروني: ${input.input.email || "غير مدخل"}`,
    "",
    "تفاصيل طلب التمويل:",
    `- المبلغ المطلوب: ${input.input.requestedAmount.toLocaleString("ar-SA")} ريال`,
    `- مدة السداد المفضلة: ${input.input.termMonths} شهر`,
    `- الغرض من التمويل: ${input.input.purpose || "غير مدخل"}`,
    `- ملاحظات إضافية: ${input.input.notes || "لا توجد"}`,
    "",
    "المرفقات — إن وجدت — مضافة مع هذا البريد.",
  ].join("\n");
}
