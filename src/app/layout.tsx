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
      <body className={cn(inter.className, "min-h-screen bg-slate-50")}>
        <Gatekeeper>
          <ToasterProvider />
          <div className="relative flex min-h-screen">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-40">
              <Sidebar />
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col md:pl-64 min-w-0 min-h-screen">
              <Navbar />
              <main className="flex-1 overflow-x-hidden">
                {children}
              </main>
            </div>
          </div>
        </Gatekeeper>
      </body>
    </html>
  );
}
