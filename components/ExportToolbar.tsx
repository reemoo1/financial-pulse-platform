"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, FileDown, Landmark, Loader2 } from "lucide-react";
import { StoredReport, CompanyReportData, StartupReportData } from "@/lib/types";


function toSafeCsvCell(value: unknown): string {
  let text = String(value ?? "");
  // Prevent spreadsheet formula injection when a CSV is opened in Excel.
  if (/^[=+@-]/.test(text.trimStart())) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

interface Props {
  report: StoredReport;
  targetRef: React.RefObject<HTMLDivElement>;
  journeyHref?: string;
}

export default function ExportToolbar({ report, targetRef, journeyHref }: Props) {
  const [exporting, setExporting] = useState<"pdf" | "csv" | null>(null);

  async function exportPdf() {
    if (!targetRef.current) return;
    setExporting("pdf");
    try {
      const { exportElementToPdf } = await import("@/lib/pdfExport");
      await exportElementToPdf(
        targetRef.current,
        `financial-pulse-report-${report.id.slice(0, 8)}.pdf`
      );
    } finally {
      setExporting(null);
    }
  }

  function exportSpreadsheet() {
    setExporting("csv");
    try {
      const rows: Record<string, string | number>[] = [];

      if (report.type === "company") {
        const d = report.data as CompanyReportData;
        rows.push(
          { المؤشر: "اسم الشركة", القيمة: d.companyName },
          { المؤشر: "القطاع", القيمة: d.sector },
          { المؤشر: "نسبة السيولة", القيمة: d.ratios.liquidityRatio },
          { المؤشر: "نسبة المديونية", القيمة: d.ratios.debtRatio },
          { المؤشر: "هامش الربح", القيمة: d.ratios.profitMargin },
          {
            المؤشر: "التدفق التشغيلي إلى الالتزامات %",
            القيمة:
              d.ratios.cashFlow == null ? "-" : d.ratios.cashFlow * 100,
          },
          {
            المؤشر: "درجة الصحة المالية %",
            القيمة: d.risk.healthScore ?? 100 - d.risk.defaultProbability,
          },
          { المؤشر: "احتمال التعثر التقديري خلال 12 شهراً %", القيمة: d.risk.defaultProbability },
          { المؤشر: "مستوى المخاطر", القيمة: d.risk.riskLevel },
          { المؤشر: "توافق رؤية 2030 %", القيمة: d.vision2030.score },
          {
            المؤشر: d.funding.isPreliminary
              ? "التمويل التقديري الأولي"
              : "التمويل الموصى به",
            القيمة: d.funding.amount,
          },
          { المؤشر: "نسبة الفائدة المقترحة %", القيمة: d.funding.interestRate },
          {
            المؤشر: "نسبة تغطية الضمان المطلوبة %",
            القيمة:
              (d.funding.collateral?.requiredCoverageRatio ?? 0) * 100,
          },
          {
            المؤشر: "قيمة الضمان المؤهل المطلوبة",
            القيمة: d.funding.collateral?.requiredEligibleValue ?? 0,
          },
          { المؤشر: "DSCR المستهدف", القيمة: d.funding.calculation?.targetDscr ?? "-" },
          { المؤشر: "القيد الحاكم لمبلغ التمويل", القيمة: d.funding.calculation?.bindingConstraint ?? "-" },
          { المؤشر: "حد التدفق النقدي", القيمة: d.funding.calculation?.cashFlowCapacity ?? "-" },
          { المؤشر: "حد صافي الأصول", القيمة: d.funding.calculation?.assetBackedCapacity ?? "-" },
          { المؤشر: "حد المديونية", القيمة: d.funding.calculation?.leverageCapacity ?? "-" },
          { المؤشر: "حد الإيرادات", القيمة: d.funding.calculation?.revenueCapacity ?? "-" },
          { المؤشر: "التوصية", القيمة: d.funding.recommendationText }
        );

        (d.risk.components || []).forEach((component) => {
          rows.push({
            المؤشر: `مكوّن الصحة المالية: ${component.label} (وزن ${Math.round(component.weight * 100)}%)`,
            القيمة: component.score,
          });
        });

        if (d.financingLifecycle) {
          rows.push(
            {
              المؤشر: "درجة الإنذار المبكر %",
              القيمة: d.financingLifecycle.monitoringPlan.earlyWarningScore,
            },
            {
              المؤشر: "منهجية الإنذار المبكر",
              القيمة: d.financingLifecycle.monitoringPlan.earlyWarningMethodology || "-",
            },
          );
        }
      } else {
        const d = report.data as StartupReportData;
        rows.push(
          { المؤشر: "اسم المشروع", القيمة: d.input.projectName },
          { المؤشر: "القطاع", القيمة: d.input.sector },
          { المؤشر: "نسبة النجاح %", القيمة: d.successProbability },
          { المؤشر: "قابل للنجاح", القيمة: d.feasible ? "نعم" : "يحتاج مراجعة" },
          { المؤشر: "توافق رؤية 2030 %", القيمة: d.vision2030.score },
          { المؤشر: "رأس المال الموصى به", القيمة: d.recommendedCapital },
          { المؤشر: "التمويل المطلوب", القيمة: d.fundingNeeded },
          { المؤشر: "مدة استرداد رأس المال (أشهر)", القيمة: d.paybackMonths }
        );
      }

      const headers = ["المؤشر", "القيمة"];
      const csv = [
        headers.map(toSafeCsvCell).join(","),
        ...rows.map((row) =>
          [row["المؤشر"], row["القيمة"]].map(toSafeCsvCell).join(","),
        ),
      ].join("\r\n");
      const blob = new Blob(["\uFEFF", csv], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `financial-pulse-report-${report.id.slice(0, 8)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {journeyHref && (
        <Link
          href={journeyHref}
          className="flex items-center gap-2 rounded-xl bg-[#0B1F3A] px-5 py-2.5 text-sm font-bold text-white transition-colors duration-150 hover:bg-[#13294B]"
        >
          <Landmark className="h-4 w-4" />
          بدء رحلة التمويل
        </Link>
      )}
      <button
        onClick={exportPdf}
        disabled={!!exporting}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B1F3A] text-white text-sm font-semibold transition-colors duration-150 hover:bg-[#13294B] disabled:opacity-60"
      >
        {exporting === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
        تحميل PDF
      </button>
      <button
        onClick={exportSpreadsheet}
        disabled={!!exporting}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#D9E2EC] text-sm font-semibold hover:bg-[#F8FAFC] transition-colors duration-150 disabled:opacity-60"
      >
        {exporting === "csv" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        تحميل Excel / CSV
      </button>
    </div>
  );
}
