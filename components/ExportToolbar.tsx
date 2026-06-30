"use client";

import { useState } from "react";
import { Download, FileDown, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { StoredReport, CompanyReportData, StartupReportData } from "@/lib/types";

interface Props {
  report: StoredReport;
  targetRef: React.RefObject<HTMLDivElement>;
}

export default function ExportToolbar({ report, targetRef }: Props) {
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);

  async function exportPdf() {
    if (!targetRef.current) return;
    setExporting("pdf");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(targetRef.current, { scale: 2, backgroundColor: "#FAF9F6" });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, pageWidth, imgHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pageWidth, imgHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }

      pdf.save(`financial-pulse-report-${report.id.slice(0, 8)}.pdf`);
    } finally {
      setExporting(null);
    }
  }

  function exportExcel() {
    setExporting("xlsx");
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
          { المؤشر: "التدفق النقدي", القيمة: d.ratios.cashFlow },
          { المؤشر: "احتمالية التعثر %", القيمة: d.risk.defaultProbability },
          { المؤشر: "مستوى المخاطر", القيمة: d.risk.riskLevel },
          { المؤشر: "توافق رؤية 2030 %", القيمة: d.vision2030.score },
          { المؤشر: "التمويل الموصى به", القيمة: d.funding.amount },
          { المؤشر: "نسبة الفائدة المقترحة %", القيمة: d.funding.interestRate },
          { المؤشر: "التوصية", القيمة: d.funding.recommendationText }
        );
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

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "تقرير النبض المالي");
      XLSX.writeFile(wb, `financial-pulse-report-${report.id.slice(0, 8)}.xlsx`);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="flex gap-3">
      <button
        onClick={exportPdf}
        disabled={!!exporting}
        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-fp-ink text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {exporting === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
        تحميل PDF
      </button>
      <button
        onClick={exportExcel}
        disabled={!!exporting}
        className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-black/15 text-sm font-semibold hover:bg-black/5 transition-colors disabled:opacity-60"
      >
        {exporting === "xlsx" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        تحميل Excel
      </button>
    </div>
  );
}
