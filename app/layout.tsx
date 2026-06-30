import type { Metadata } from "next";
import { Tajawal, Noto_Kufi_Arabic } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "700", "900"],
  variable: "--font-tajawal",
});

const kufi = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  weight: ["400", "600", "700"],
  variable: "--font-kufi",
});

export const metadata: Metadata = {
  title: "النبض المالي | منصة تحليل مخاطر التمويل المؤسسي",
  description:
    "كل قرض خاطئ يكلف البنك ملايين — النبض المالي يرصد المخاطر قبل أن تقع",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={`${tajawal.variable} ${kufi.variable}`}>
      <body className="min-h-screen bg-fp-paper text-fp-ink flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
