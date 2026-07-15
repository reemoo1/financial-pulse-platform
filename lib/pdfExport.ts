// Shared "render a div into a paginated PDF" utility.
//
// Arabic text needs the browser's own rendering (fonts, RTL shaping) — jsPDF
// alone can't shape Arabic script correctly. So we render real HTML/Tailwind,
// capture it with html2canvas, and embed the capture into the PDF.
//
// Two fixes vs. the naive approach that produced ~68MB files:
//  1. JPEG (quality 0.85) instead of PNG — dashboards are flat-color UI,
//     JPEG at this quality is visually lossless here and ~10x smaller.
//  2. The canvas is SLICED per page and each page embeds only its own slice.
//     The old code re-embedded the ENTIRE full-height image on every page
//     (offset upward), multiplying file size by the page count.
//
// Each page also gets a footer with page numbers and the generation date.

export async function exportElementToPdf(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#FAF9F6",
    useCORS: true,
  });

  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();
  const footerMm = 10; // reserved strip at the bottom of each page
  const contentHeightMm = pageHeightMm - footerMm;

  // Height of one PDF page expressed in canvas pixels.
  const pageHeightPx = Math.floor(
    (contentHeightMm * canvas.width) / pageWidthMm
  );
  const pageCount = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

  const sliceCanvas = document.createElement("canvas");
  const ctx = sliceCanvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const generatedOn = new Date().toISOString().slice(0, 10);

  for (let page = 0; page < pageCount; page++) {
    const sourceY = page * pageHeightPx;
    const sliceHeightPx = Math.min(pageHeightPx, canvas.height - sourceY);

    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeightPx;
    ctx.fillStyle = "#FAF9F6";
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    ctx.drawImage(
      canvas,
      0,
      sourceY,
      canvas.width,
      sliceHeightPx,
      0,
      0,
      canvas.width,
      sliceHeightPx
    );

    const imgData = sliceCanvas.toDataURL("image/jpeg", 0.85);
    const sliceHeightMm = (sliceHeightPx * pageWidthMm) / canvas.width;

    if (page > 0) pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, 0, pageWidthMm, sliceHeightMm);

    // Footer: page number + generation date (Latin glyphs render fine in
    // jsPDF core fonts; Arabic would need an embedded font).
    pdf.setFontSize(8);
    pdf.setTextColor(120);
    pdf.text(
      `Financial Pulse  ·  ${generatedOn}  ·  ${page + 1} / ${pageCount}`,
      pageWidthMm / 2,
      pageHeightMm - 4,
      { align: "center" }
    );
  }

  pdf.save(filename);
}
