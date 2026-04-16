import { getCurrentTenantId } from "@/lib/tenant";
import { AuditSessionProvider } from "@/components/audit/AuditSessionProvider";
import { InvestigationModePanel } from "@/components/audit/InvestigationModePanel";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Tryb Dochodzeniowy | SIG ERP",
  description: "Zaawansowana weryfikacja fiskalna i audyt AI dokumentów.",
};

export default async function InvestigationPage() {
  const tenantId = await getCurrentTenantId();

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* HEADER WITH NAVIGATION */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link 
            href="/finanse/audit" 
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-xs font-black uppercase tracking-widest group mb-4"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Powrót do Audytu
          </Link>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
              <ShieldAlert className="w-8 h-8" />
            </div>
            Tryb Dochodzeniowy
          </h1>
          <p className="text-slate-500 font-medium">Expert-Level Fiscal Investigation • Vector 180.15</p>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Systemu</span>
                <span className="text-sm font-bold text-emerald-600 flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> AI Auditor Ready
                </span>
            </div>
        </div>
      </div>

      {/* MAIN INVESTIGATION CONTEXT */}
      <AuditSessionProvider>
        <InvestigationModePanel tenantId={tenantId} />
      </AuditSessionProvider>
    </div>
  );
}
