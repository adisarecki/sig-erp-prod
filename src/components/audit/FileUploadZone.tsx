/**
 * File Upload Zone Component - Vector 180.15
 * Drag & drop upload zone for 1-5 invoice files simultaneously
 */

"use client";

import React, { useState, useRef } from "react";
import { useAuditSession } from "./AuditSessionProvider";
import { Upload, AlertCircle, CheckCircle } from "lucide-react";

interface UploadProgress {
  fileName: string;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

export function FileUploadZone() {
  const { uploadItems, isLoading } = useAuditSession();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILES = 5;
  const ALLOWED_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "text/csv",
  ];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  const handleFiles = (files: File[]) => {
    if (files.length > MAX_FILES) {
      alert(`Maximum ${MAX_FILES} files allowed. ${files.length} selected.`);
      return;
    }

    // Validate file types
    const invalidFiles = files.filter(
      (f) => !ALLOWED_TYPES.includes(f.type)
    );
    if (invalidFiles.length > 0) {
      alert(`Invalid file types: ${invalidFiles.map((f) => f.name).join(", ")}`);
      return;
    }

    setSelectedFiles(files);

    // Initialize progress tracking
    setUploadProgress(
      files.map((f) => ({
        fileName: f.name,
        progress: 0,
        status: "pending",
      }))
    );

    // Simulate upload (in real app, would parse OCR)
    simulateUpload(files);
  };

  const simulateUpload = async (files: File[]) => {
        try {
            const parsedItems: any[] = [];

            for (const file of files) {
                const formData = new FormData();
                formData.append("file", file);

                const response = await fetch("/api/ocr/scan", {
                    method: "POST",
                    body: formData,
                });

                const result = await response.json();
                if (!response.ok || !result.success) {
                    throw new Error(result.error || `OCR upload failed for ${file.name}`);
                }

                if (!Array.isArray(result.data)) {
                    throw new Error(`OCR returned invalid data for ${file.name}`);
                }

                result.data.forEach((data: any, idx: number) => {
                    parsedItems.push({
                        invoiceNumber: data.invoiceNumber || `OCR-${Date.now()}-${idx}`,
                        issueDate: data.issueDate ? new Date(data.issueDate) : new Date(),
                        nip: data.nip || data.sellerNip || data.buyerNip || "",
                        contractorName: data.parsedName || data.contractorName || "Unknown Contractor",
                        netAmount: data.netAmount ?? 0,
                        vatAmount: data.vatAmount ?? undefined,
                        grossAmount: data.grossAmount ?? undefined,
                        vatRate: data.vatRate ?? 0.23,
                        ocrConfidence: data.ocrConfidence ?? 80,
                        rawOcrData: data,
                        licensePlate: data.licensePlate,
                    });
                });
            }

            if (parsedItems.length === 0) {
                throw new Error("OCR did not return any invoice items.");
            }

            await uploadItems(parsedItems);

            setUploadProgress((prev) =>
              prev.map((p) => ({
                ...p,
                progress: 100,
                status: "success",
              }))
            );
        } catch (error: any) {
            setUploadProgress((prev) =>
              prev.map((p) => ({
                ...p,
                status: "error",
                error: error.message,
              }))
            );
        }
    };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        className={`relative p-8 border-2 border-dashed rounded-lg text-center transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 bg-gray-50 hover:border-blue-400"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.csv"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isLoading}
        />

        <div className="flex flex-col items-center gap-3">
          <Upload className="w-12 h-12 text-gray-400" />

          <div>
            <h3 className="font-semibold text-gray-900">
              Drag & drop your invoice files
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              or{" "}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 hover:underline font-medium"
              >
                select files
              </button>
            </p>
          </div>

          <p className="text-xs text-gray-500">
            Supported: PDF, JPEG, PNG, CSV • Max {MAX_FILES} files
          </p>
        </div>
      </div>

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <div className="space-y-2">
          {uploadProgress.map((file, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{file.fileName}</span>
                  <span className="text-xs text-gray-500">{file.progress}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${file.progress}%` }}
                  />
                </div>
              </div>

              {file.status === "success" && (
                <CheckCircle className="w-5 h-5 text-green-600" />
              )}
              {file.status === "error" && (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Summary */}
      {selectedFiles.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <p className="text-blue-900">
            {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""}{" "}
            ready for upload
          </p>
        </div>
      )}
    </div>
  );
}
