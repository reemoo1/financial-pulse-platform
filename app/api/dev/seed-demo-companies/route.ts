import { NextResponse } from "next/server";
import {
  getFinancingRequestByReferenceNumber,
  saveFinancingRequest,
  updateFinancingRequestSecurity,
} from "@/lib/store";
import { hashOtp } from "@/lib/otp";
import { DEMO_SCENARIOS } from "@/lib/demoScenarios";

// نقطة تشغيل لمرة واحدة فقط — تُنشئ 3 طلبات تمويل حقيقية في قاعدة البيانات
// (تظهر تلقائيًا في /bank/dashboard و/bank/requests و/bank/monitoring، وتُستعلَم
// عنها من الصفحة الحقيقية /inquiry) باستخدام نفس رقم المعاملة ورمز الـOTP
// الثابتين الموجودين في lib/demoScenarios.ts.
// احذفي هذا الملف بعد الهاكاثون — هذا مسار تطوير فقط وليس جزءًا من المنتج.

const BANKS = {
  high: { id: "bank-inma-1", name: "مصرف الإنماء", minRate: 4.5, maxRate: 9.5, strengths: "تمويل مؤسسي ومتابعة ائتمانية" },
  medium: { id: "bank-inma-1", name: "مصرف الإنماء", minRate: 4.5, maxRate: 9.5, strengths: "تمويل مؤسسي ومتابعة ائتمانية" },
  low: { id: "bank-inma-1", name: "مصرف الإنماء", minRate: 4.5, maxRate: 9.5, strengths: "تمويل مؤسسي ومتابعة ائتمانية" },
};

const CONTACT_EMAIL: Record<string, string> = {
  high: "contact@alofoq-contracting.demo",
  medium: "contact@elite-trading.demo",
  low: "contact@modern-tech.demo",
};

function buildInstallments(scenarioKey: string, amount: number, termMonths: number) {
  const monthly = Math.round((amount / termMonths) * 100) / 100;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const installments = [];
  const paidCount =
    scenarioKey === "high" ? 4 : scenarioKey === "medium" ? 5 : 6;
  const overdueCount =
    scenarioKey === "high" ? 2 : scenarioKey === "medium" ? 1 : 0;
  const totalShown = paidCount + overdueCount + 2; // إضافة قسطين قادمين للسياق

  for (let i = 0; i < totalShown; i++) {
    const sequence = i + 1;
    const dueDate = new Date(now - (paidCount + overdueCount - i) * 30 * dayMs);
    let status: "paid" | "late" | "upcoming" = "upcoming";
    let paidAmount = 0;
    let daysPastDue = 0;
    let paidAt: string | undefined;

    if (i < paidCount) {
      status = "paid";
      paidAmount = monthly;
      paidAt = new Date(dueDate.getTime() + 1 * dayMs).toISOString();
    } else if (i < paidCount + overdueCount) {
      status = "late";
      daysPastDue = scenarioKey === "high" ? 61 - (i - paidCount) * 30 : 30;
    }

    installments.push({
      id: `demo-${scenarioKey}-inst-${sequence}`,
      sequence,
      dueDate: dueDate.toISOString(),
      principal: Math.round(monthly * 0.8),
      profit: Math.round(monthly * 0.2),
      amountDue: monthly,
      paidAmount,
      paidAt,
      daysPastDue,
      status,
    });
  }
  return installments;
}

function buildLifecycleStages(scenarioKey: string) {
  const base = [
    { key: "submitted", label: "تقديم الطلب", description: "استلام بيانات الشركة وطلب التمويل." },
    { key: "data_review", label: "التحقق من البيانات", description: "التأكد من اكتمال القوائم المالية وصحة القيم." },
    { key: "analysis_completed", label: "التحليل المالي", description: "حساب المؤشرات والمخاطر والتوصية التمويلية." },
    { key: "bank_review", label: "مراجعة البنك", description: "فحص الطلب من جهة التمويل ومطابقة السياسات الائتمانية." },
    { key: "conditional_approval", label: "موافقة مشروطة", description: "الموافقة الأولية مرتبطة بالشروط والضمانات." },
    { key: "guarantee_required", label: "تحديد الضمانات", description: "تسجيل الضمانات المطلوبة قبل الصرف النهائي." },
    { key: "approved", label: "اعتماد التمويل", description: "اعتماد مبلغ التمويل وجدول السداد." },
    { key: "disbursed", label: "صرف التمويل", description: "صرف التمويل مرة واحدة أو على دفعات حسب شروط الموافقة." },
    { key: "monitoring", label: "متابعة شهرية", description: "متابعة السداد والتدفقات النقدية ومؤشرات التعثر." },
    { key: "warning", label: "إنذار مبكر", description: "تنبيه عند انخفاض قدرة السداد أو ظهور مؤشرات خطر." },
  ] as const;

  const currentIndex = scenarioKey === "high" ? 9 : scenarioKey === "medium" ? 8 : 8;
  return base.map((stage, index) => ({
    ...stage,
    state:
      index < currentIndex
        ? "completed"
        : index === currentIndex
          ? scenarioKey === "high"
            ? "blocked"
            : "current"
          : "pending",
  }));
}

export async function GET() {
  const created: { scenario: string; id: string; referenceNumber: string; otp: string }[] = [];
  const skipped: string[] = [];

  for (const scenario of DEMO_SCENARIOS) {
    const existing = await getFinancingRequestByReferenceNumber(scenario.referenceNumber);
    const amount = scenario.amount || 3_000_000;
    const termMonths = 36;
    const installments = buildInstallments(scenario.key, amount, termMonths);
    const totalDisbursed = amount;
    const now = new Date().toISOString();

    const status =
      scenario.riskLevel === "high" ? "warning" : "monitoring";

    const record: any = {
      input: {
        reportId: `demo-${scenario.key}`,
        contactName: scenario.companyName,
        phone: "0500000000",
        email: CONTACT_EMAIL[scenario.key],
        requestedAmount: amount,
        purpose: "رأس مال عامل وتوسعة النشاط",
        termMonths,
        notes: "حالة محاكاة لعرض الهاكاثون — بيانات وهمية بالكامل.",
        crNumber: `10${scenario.key === "high" ? "1" : scenario.key === "medium" ? "2" : "3"}0000000`,
        detailedActivity: scenario.sector,
        establishmentDate: "2019-01-01",
        companyAgeYears: 7,
      },
      referenceNumber: scenario.referenceNumber,
      applicantName: scenario.companyName,
      applicantType: "company",
      sector: scenario.sector,
      bankQuote: {
        bank: BANKS[scenario.key as keyof typeof BANKS],
        estimatedRate: 7.2,
        notes: [scenario.bankAlert],
      },
      status,
      lifecycle: {
        status,
        statusLabel: scenario.riskLevel === "high" ? "تعثر — إجراءات نظامية" : scenario.riskLevel === "medium" ? "تأخير — متابعة دورية" : "التزام كامل",
        stages: buildLifecycleStages(scenario.key),
        guaranteePlan: {
          requiredAmount: Math.round(amount * 0.3),
          coverageRatio: scenario.riskLevel === "high" ? 0.6 : scenario.riskLevel === "medium" ? 0.9 : 1,
          status: scenario.riskLevel === "high" ? "required" : "accepted",
          recommendedType: "رهن تجاري / ضمان بنكي",
          items: [
            { type: "commercial_pledge", label: "رهن تجاري", required: true, note: "مسجل ضمن ملف الطلب." },
          ],
        },
        monitoringPlan: { cadence: "monthly", nextReviewNote: "مراجعة دورية شهرية لحالة السداد." },
        protectionPlan: { mechanism: "ضمان بنكي + متابعة شهرية للتدفقات النقدية." },
        nextActions:
          scenario.riskLevel === "high"
            ? ["إرسال تحذير رسمي بتفعيل الضمان", "تصعيد الملف لإدارة التحصيل"]
            : scenario.riskLevel === "medium"
              ? ["إرسال تذكير للشركة", "مراجعة نسبة الالتزام الشهر القادم"]
              : ["الاستمرار بالمتابعة الدورية الاعتيادية"],
        methodology: "تُحسب الحالة بناءً على عدد الأقساط المتأخرة ونسبة الالتزام بالسداد.",
      },
      uploadedFiles: [],
      history: [
        { status: "submitted", note: "تم استلام الطلب.", updatedAt: now, actor: "system" },
        { status: "approved", note: "تم اعتماد التمويل.", updatedAt: now, actor: "bank", actorName: "فريق الائتمان" },
        { status: "disbursed", note: "تم صرف مبلغ التمويل بالكامل.", updatedAt: now, actor: "bank", actorName: "فريق العمليات" },
        { status, note: scenario.bankAlert, updatedAt: now, actor: "system" },
      ],
      metadata: {
        ticketNumber: scenario.referenceNumber,
        inquiryNumber: scenario.referenceNumber,
        submissionDate: now,
        lastUpdate: now,
        submissionMode: "manual",
      },
      monitoring: {
        cadence: "monthly",
        nextSubmissionDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
        snapshots: [
          {
            id: `demo-${scenario.key}-snap-1`,
            period: new Date().toISOString().slice(0, 7),
            submittedAt: now,
            revenue: amount * 0.4,
            operatingCashFlow: amount * 0.12,
            maintenanceCapex: amount * 0.02,
            cfads: amount * 0.1,
            totalDebt: amount,
            currentAssets: amount * 0.5,
            currentLiabilities: amount * 0.3,
            scheduledPrincipal: Math.round(amount / termMonths),
            scheduledInterest: Math.round(amount * 0.02),
            mandatoryDebtFees: 0,
            financeLeasePayments: 0,
            contractualDebtService: Math.round(amount / termMonths),
            annualDebtService: Math.round(amount / termMonths) * 12,
            installmentDue: Math.round(amount / termMonths),
            installmentPaid: scenario.riskLevel === "high" ? 0 : Math.round(amount / termMonths),
            daysPastDue: scenario.daysLate,
            currentRatio: scenario.riskLevel === "high" ? 0.8 : scenario.riskLevel === "medium" ? 1.1 : 1.6,
            debtRatio: scenario.riskLevel === "high" ? 0.75 : scenario.riskLevel === "medium" ? 0.55 : 0.35,
            dscr: scenario.riskLevel === "high" ? 0.7 : scenario.riskLevel === "medium" ? 1.05 : 1.8,
            dscrMethod: "cfads_contractual",
            revenueChange: null,
            cashFlowChange: null,
            daysPastDueTrend: null,
            healthScore: scenario.commitmentRate,
            probabilityOfDefault: scenario.riskLevel === "high" ? 42 : scenario.riskLevel === "medium" ? 18 : 4,
            probabilityModelStatus: "validated",
            regulatoryUseAllowed: true,
            earlyWarningScore: scenario.riskLevel === "high" ? 78 : scenario.riskLevel === "medium" ? 42 : 8,
            creditStage: scenario.riskLevel === "high" ? "stage3" : scenario.riskLevel === "medium" ? "stage2" : "stage1",
            stageReasons:
              scenario.riskLevel === "high"
                ? ["تجاوز 90 يومًا تراكميًا من التأخير", "انخفاض DSCR عن الحد الأدنى"]
                : scenario.riskLevel === "medium"
                  ? ["تأخير متكرر خلال آخر 3 أشهر"]
                  : ["لا توجد مؤشرات خطر"],
            status: scenario.riskLevel === "high" ? "default" : scenario.riskLevel === "medium" ? "watch" : "healthy",
            alerts: scenario.riskLevel === "high" ? ["تعثر فعلي في السداد", "انخفاض التغطية النقدية"] : scenario.riskLevel === "medium" ? ["تأخير متكرر بالسداد"] : [],
            recommendedActions:
              scenario.riskLevel === "high"
                ? ["إرسال تحذير رسمي بتفعيل الضمان", "تصعيد الملف لإدارة التحصيل"]
                : scenario.riskLevel === "medium"
                  ? ["إرسال تذكير للشركة", "مراجعة نسبة الالتزام الشهر القادم"]
                  : ["الاستمرار بالمتابعة الدورية الاعتيادية"],
          },
        ],
        actions:
          scenario.riskLevel === "high"
            ? [{ id: `demo-${scenario.key}-action-1`, createdAt: now, title: "تفعيل الضمان البنكي إذا استمر التعثر", owner: "إدارة التحصيل", status: "open" }]
            : [],
      },
      operations: {
        disbursements: [
          {
            id: `demo-${scenario.key}-disb-1`,
            amount: totalDisbursed,
            mode: "full",
            beneficiaryName: scenario.companyName,
            beneficiaryIban: "SA0000000000000000000000",
            beneficiaryBank: "مصرف الإنماء",
            transferReference: `TRX-${scenario.key.toUpperCase()}`,
            disbursementDate: now,
            recordedAt: now,
            recordedBy: "فريق العمليات",
          },
        ],
        totalDisbursed,
        remainingUndisbursed: 0,
        installments,
        collectionEvents: [],
        restructuringPlans: [],
        totalRecovered: 0,
      },
    };

    const id = await saveFinancingRequest(record, existing?.id);
    const { salt, hash } = hashOtp(scenario.otp);
    await updateFinancingRequestSecurity(id, {
      otpSalt: salt,
      otpHash: hash,
      otpCreatedAt: now,
      otpExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      otpAttemptCount: 0,
      otpMaxAttempts: 1000,
    });

    created.push({ scenario: scenario.key, id, referenceNumber: scenario.referenceNumber, otp: scenario.otp });
  }

  return NextResponse.json({ created, skipped }, { headers: { "Cache-Control": "no-store" } });
}
