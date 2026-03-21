import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SIG ERP - Firmowy System Finansowo-Zarządczy",
  description: "Zarządzanie finansami, płatnościami i CRM pod klucz.",
};

import { Gatekeeper } from "@/components/auth/Gatekeeper";
import { ToasterProvider } from "@/components/providers/ToasterProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className={cn("font-sans", geist.variable)}>
      <body className={`${inter.className} overflow-x-hidden`}>
        <Gatekeeper>
          <ToasterProvider />
          <div className="flex min-h-screen bg-slate-50 w-full max-w-full overflow-x-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <Navbar />
              <main className="flex-1 p-6 overflow-x-hidden">
                {children}
              </main>
            </div>
          </div>
        </Gatekeeper>
      </body>
    </html>
  );
}
