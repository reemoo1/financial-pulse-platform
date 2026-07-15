import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LanguageProvider from "@/components/LanguageProvider";

export const dynamic = "force-dynamic";


export const metadata: Metadata = {
  title: "النبض المالي | بوابة الشركات",
  description:
    "كل قرض خاطئ يكلف البنك ملايين — النبض المالي يرصد المخاطر قبل أن تقع",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
        <LanguageProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
