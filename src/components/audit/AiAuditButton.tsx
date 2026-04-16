"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, ClipboardCheck, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface AiAuditButtonProps {
  tenantId: string;
}

export function AiAuditButton({ tenantId }: AiAuditButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleRunAudit = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/ai/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          auditScope: "INTEGRITY_CHECK",
          priority: "HIGH",
        }),
      });

      const data = await response.json();
      setResult(data);
      setShowResult(true);
    } catch (err) {
      console.error("AI Audit failed", err);
      alert("Błąd podczas uruchamiania audytu AI.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleRunAudit}
        disabled={loading}
        className="h-12 px-6 rounded-2xl font-black bg-indigo-600 hover:bg-slate-900 text-white shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center gap-2 group border-none"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Sparkles className="w-5 h-5 text-indigo-300 group-hover:rotate-12 transition-transform" />
        )}
        {loading ? "Analizowanie Systemu..." : "Audytor AI (Vector 300)"}
      </Button>

      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto rounded-3xl border-indigo-100 p-0 overflow-hidden">
          <div className="bg-slate-900 p-8 text-white relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <DialogHeader className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-indigo-500/20 rounded-xl">
                  <Sparkles className="w-6 h-6 text-indigo-300" />
                </div>
                <DialogTitle className="text-2xl font-black tracking-tight text-white">
                  Raport Diagnostyczny AI
                </DialogTitle>
              </div>
              <DialogDescription className="text-slate-400 font-medium">
                Wynik analizy spójności i architektury finansowej SIG ERP.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-8 space-y-6 bg-white">
            {result?.success ? (
              <div className="space-y-6">
                <div className="flex items-center gap-2 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-700">
                  <ClipboardCheck className="w-5 h-5" />
                  <span className="font-bold">Audyt zakończony pomyślnie.</span>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Wnioski i Zalecenia:</h3>
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-slate-700 font-medium leading-relaxed whitespace-pre-wrap text-sm italic">
                    {result.auditReport || "Brak szczegółowych wniosków w raporcie."}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Log ID</p>
                    <p className="font-mono text-xs text-slate-600">{result.logId}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Model</p>
                    <p className="font-bold text-slate-900">OpenAI o1-preview</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Błąd Audytu</h3>
                  <p className="text-slate-500">{result?.error || "Nie udało się pobrać raportu."}</p>
                </div>
              </div>
            )}

            <div className="pt-4">
              <Button
                onClick={() => setShowResult(false)}
                className="w-full h-12 rounded-2xl bg-slate-900 hover:bg-black text-white font-black uppercase tracking-widest"
              >
                Zamknij Raport
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
