// Shared "screenshot a div, embed it as a PDF" utility.
//
// Arabic text needs the browser's own rendering (fonts, RTL shaping) — jsPDF
// alone can't render Arabic script correctly. So instead of drawing text
// directly with jsPDF, we render real HTML/JSX with Tailwind classes,
// screenshot it with html2canvas, and embed that image into the PDF. This
// keeps the output looking exactly like what's on screen, in correct Arabic.

export async function exportElementToPdf(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#FAF9F6" });
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

  pdf.save(filename);
}
