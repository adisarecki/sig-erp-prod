/**
 * Audit Session Context Provider - Vector 180.15
 * Manages investigation session state across UI components
 */

"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { LiveSummary } from "@/lib/audit";
import Decimal from "decimal.js";

interface AuditSessionContextType {
  sessionId: string | null;
  tenantId: string | null;
  session: any | null;
  liveSummary: LiveSummary | null;
  isLoading: boolean;
  error: string | null;
  
  createSession: (tenantId: string, sourceYear: number, sourceMonth?: number) => Promise<string>;
  uploadItems: (items: any[]) => Promise<void>;
  verifyAll: () => Promise<void>;
  finalizeSession: () => Promise<void>;
  updateLiveSummary: () => Promise<void>;
}

const AuditSessionContext = createContext<AuditSessionContextType | undefined>(undefined);

export function AuditSessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [liveSummary, setLiveSummary] = useState<LiveSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = useCallback(
    async (tenantId: string, sourceYear: number, sourceMonth?: number) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/audit/session/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, sourceYear, sourceMonth }),
        });

        if (!response.ok) {
          throw new Error("Failed to create session");
        }

        const session = await response.json();
        setSessionId(session.id);
        setTenantId(tenantId);
        setSession(session);
        return session.id;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const uploadItems = useCallback(
    async (items: any[]) => {
      if (!sessionId || !tenantId) throw new Error("No active session");

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/audit/session/${sessionId}/upload`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tenantId, items }),
          }
        );

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        await updateLiveSummary();
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, tenantId, updateLiveSummary]
  );

  const verifyAll = useCallback(
    async () => {
      if (!sessionId || !tenantId) throw new Error("No active session");

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/audit/session/${sessionId}/verify`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tenantId, autoVerifyAll: true }),
          }
        );

        if (!response.ok) {
          throw new Error("Verification failed");
        }

        await updateLiveSummary();
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, tenantId]
  );

  const updateLiveSummary = useCallback(
    async () => {
      if (!sessionId || !tenantId) return;

      try {
        const response = await fetch(
          `/api/audit/session/${sessionId}?tenantId=${tenantId}`
        );

        if (response.ok) {
          const data = await response.json();
          setLiveSummary(data.liveSummary);
          setSession(data.session);
        }
      } catch (err) {
        console.error("Failed to update live summary", err);
      }
    },
    [sessionId, tenantId]
  );

  const finalizeSession = useCallback(
    async () => {
      if (!sessionId || !tenantId) throw new Error("No active session");

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/audit/session/${sessionId}/finalize`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tenantId }),
          }
        );

        if (!response.ok) {
          throw new Error("Finalization failed");
        }

        // Clear session after finalization
        setSessionId(null);
        setSession(null);
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, tenantId]
  );

  return (
    <AuditSessionContext.Provider
      value={{
        sessionId,
        tenantId,
        session,
        liveSummary,
        isLoading,
        error,
        createSession,
        uploadItems,
        verifyAll,
        finalizeSession,
        updateLiveSummary,
      }}
    >
      {children}
    </AuditSessionContext.Provider>
  );
}

export function useAuditSession() {
  const context = useContext(AuditSessionContext);
  if (!context) {
    throw new Error("useAuditSession must be used within AuditSessionProvider");
  }
  return context;
}
