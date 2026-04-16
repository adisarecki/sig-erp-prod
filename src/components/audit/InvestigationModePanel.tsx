/**
 * Investigation Mode Panel - Vector 180.15
 * Main UI for persistent audit and fiscal investigation
 */

"use client";

import React, { useState } from "react";
import { useAuditSession } from "./AuditSessionProvider";
import { LiveSummaryBar } from "./LiveSummaryBar";
import { FileUploadZone } from "./FileUploadZone";
import { InvestigationModeItemList } from "./InvestigationModeItemList";
import { CheckCircle2, AlertTriangle, Download } from "lucide-react";

interface InvestigationModePanelProps {
  tenantId: string;
  onClose?: () => void;
}

export function InvestigationModePanel({
  tenantId,
  onClose,
}: InvestigationModePanelProps) {
  const {
    sessionId,
    session,
    liveSummary,
    isLoading,
    error,
    createSession,
    verifyAll,
    finalizeSession,
    updateLiveSummary,
  } = useAuditSession();

  const [sourceYear, setSourceYear] = useState(new Date().getFullYear());
  const [sourceMonth, setSourceMonth] = useState<number | undefined>();
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [showSuccessPrompt, setShowSuccessPrompt] = useState(false);

  const handleStartSession = async () => {
    try {
      await createSession(tenantId, sourceYear, sourceMonth);
      setIsSessionActive(true);
    } catch (err) {
      console.error("Failed to start session", err);
    }
  };

  const handleAutoVerify = async () => {
    try {
      await verifyAll();
    } catch (err) {
      console.error("Auto-verification failed", err);
    }
  };

  const handleFinalize = async () => {
    try {
      await finalizeSession();
      setReportGenerated(true);
    } catch (err) {
      console.error("Finalization failed", err);
    }
  };

  const handleBulkApprove = async () => {
    if (!sessionId) return;

    try {
      const response = await fetch(
        `/api/audit/session/${sessionId}/bulk-approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId }),
        }
      );

      if (response.ok) {
        await updateLiveSummary();
        setShowSuccessPrompt(true);
      }
    } catch (err) {
      console.error("Bulk approve failed", err);
    }
  };

  if (!isSessionActive && !reportGenerated) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg border border-gray-200 shadow-lg">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔍 Audit Investigation Mode
          </h1>
          <p className="text-gray-600">
            Persistent Fiscal Audit System - Vector 180.15
          </p>
        </div>

        <div className="space-y-6">
          {/* Session Start Configuration */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h2 className="font-semibold text-gray-900 mb-4">
              Session Configuration
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fiscal Year
                </label>
                <input
                  type="number"
                  value={sourceYear}
                  onChange={(e) => setSourceYear(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Month (Optional)
                </label>
                <select
                  value={sourceMonth || ""}
                  onChange={(e) =>
                    setSourceMonth(e.target.value ? parseInt(e.target.value) : undefined)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Full Year</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                    <option key={m} value={m}>
                      Month {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleStartSession}
              disabled={isLoading}
              className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {isLoading ? "Starting..." : "Start Audit Session"}
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900">Error</h3>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (showSuccessPrompt) {
    return (
      <div className="w-full max-w-4xl mx-auto p-10 bg-white rounded-3xl border border-emerald-100 shadow-2xl text-center space-y-8 animate-in fade-in zoom-in duration-300">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Dokumenty Zaksięgowane! ✅</h2>
          <p className="text-slate-500 text-lg">
            Wszystkie zweryfikowane pozycje zostały pomyślnie przeniesione do Rejestru głównego.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
          <button
            onClick={() => setShowSuccessPrompt(false)}
            className="flex flex-col items-center gap-2 p-6 rounded-2xl border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition-all group"
          >
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Download className="w-6 h-6 rotate-180" />
            </div>
            <span className="font-bold text-slate-900">KONTYNUUJ WGRYWANIE</span>
            <span className="text-xs text-slate-400">Dodaj kolejne dokumenty do tej sesji</span>
          </button>

          <button
            onClick={handleFinalize}
            className="flex flex-col items-center gap-2 p-6 rounded-2xl border-2 border-slate-100 hover:border-purple-500 hover:bg-purple-50 transition-all group"
          >
            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <span className="font-bold text-slate-900">ZAKOŃCZ I RAPORT</span>
            <span className="text-xs text-slate-400">Zamknij sesję i wygeneruj podsumowanie</span>
          </button>
        </div>
      </div>
    );
  }

  if (reportGenerated) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg border border-gray-200 shadow-lg">
        <div className="text-center py-8">
          <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Audit Report Generated ✅
          </h2>
          <p className="text-gray-600 mb-6">
            Your audit session has been completed and the report is ready for download.
          </p>
          <button
            onClick={() => {
              setReportGenerated(false);
              setIsSessionActive(false);
              onClose?.();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Start New Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 p-6 bg-white rounded-lg border border-gray-200 shadow-lg">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          📊 Investigation Mode - Fiscal Audit Session
        </h1>
        <p className="text-gray-600">Session ID: {sessionId?.substring(0, 8)}...</p>
      </div>

      {/* Live Summary Bar */}
      {liveSummary && <LiveSummaryBar liveSummary={liveSummary} />}

      {/* Project Shadow & Document Linkage */}
      {session?.items && session.items.length > 0 && (
        <div className="pt-4">
          <InvestigationModeItemList items={session.items} />
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* File Upload */}
        <div className="col-span-2">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📁 Upload Invoices & Documents
          </h2>
          <FileUploadZone />
        </div>

        {/* Actions Sidebar */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Quick Actions
          </h2>

          {/* Auto-Verify Button */}
          <button
            onClick={handleAutoVerify}
            disabled={isLoading || !liveSummary || liveSummary.itemCount === 0}
            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            {isLoading ? "Verifying..." : "Auto-Verify All"}
          </button>

          {/* Bulk Approve Button (ZATWIERDŹ WSZYSTKIE) */}
          <button
            onClick={handleBulkApprove}
            disabled={isLoading || !liveSummary || liveSummary.verifiedCount === 0}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            ✅ ZATWIERDŹ WSZYSTKIE
          </button>

          {/* Finalize Button (Zakończ Wczytywanie) */}
          <button
            onClick={handleFinalize}
            disabled={isLoading || !liveSummary || liveSummary.verifiedCount === 0}
            className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            Zakończ Wczytywanie
          </button>

          {/* Status Box */}
          {liveSummary && (
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Items:</span>
                  <span className="font-semibold">
                    {liveSummary.itemCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Verified:</span>
                  <span className="font-semibold text-green-600">
                    {liveSummary.verifiedCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Pending:</span>
                  <span className="font-semibold text-yellow-600">
                    {liveSummary.pendingCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Rejected:</span>
                  <span className="font-semibold text-red-600">
                    {liveSummary.rejectedCount}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
