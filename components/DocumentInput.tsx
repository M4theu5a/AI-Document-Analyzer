"use client";

import { FileText, Upload, AlertCircle } from "lucide-react";
import React, { useState } from "react";

interface DocumentInputProps {
  isDarkTheme: boolean;
  documentName: string;
  documentText: string;
  wordCount: number;
  charCount: number;
  isExtracting: boolean;
  error?: string;
  onFileSelect: (files: FileList) => void;
  onTextChange: (text: string) => void;
}

export function DocumentInput({
  isDarkTheme,
  documentName,
  documentText,
  wordCount,
  charCount,
  isExtracting,
  error,
  onFileSelect,
  onTextChange,
}: DocumentInputProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      onFileSelect(e.dataTransfer.files);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className={`px-6 py-4 border-b ${isDarkTheme ? "border-white/10" : "border-gray-200"}`}>
        <div className="flex items-center gap-2 mb-2">
          <FileText size={20} className={isDarkTheme ? "text-doc-purple-light" : "text-doc-purple"} />
          <span className={`font-semibold ${isDarkTheme ? "text-white" : "text-gray-900"}`}>
            {documentName}
          </span>
        </div>
        <div className={`flex gap-4 text-sm ${isDarkTheme ? "text-white/50" : "text-gray-600"}`}>
          <span>{wordCount} words</span>
          <span>{charCount} characters</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {isExtracting ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className={`w-12 h-12 rounded-full mx-auto mb-3 skeleton-line`}></div>
              <p className={isDarkTheme ? "text-white/70" : "text-gray-700"}>Extracting text...</p>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className={`mx-6 mt-4 p-4 rounded-lg flex gap-3 ${
                isDarkTheme ? "bg-red-500/10 border border-red-500/30" : "bg-red-50 border border-red-200"
              }`}>
                <AlertCircle size={20} className={isDarkTheme ? "text-red-400" : "text-red-600"} />
                <p className={isDarkTheme ? "text-red-400" : "text-red-700"}>{error}</p>
              </div>
            )}

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex-1 p-6 overflow-y-auto transition-colors ${
                isDragging
                  ? isDarkTheme
                    ? "bg-doc-purple/10"
                    : "bg-doc-purple/5"
                  : ""
              }`}
            >
              {documentText ? (
                <textarea
                  value={documentText}
                  onChange={(e) => onTextChange(e.target.value)}
                  className={`w-full h-full font-mono text-sm resize-none outline-none border rounded-lg p-4 ${
                    isDarkTheme
                      ? "bg-white/5 border-white/10 text-white placeholder-white/30"
                      : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500"
                  }`}
                  placeholder="Paste your document here..."
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Upload size={48} className={isDarkTheme ? "text-white/30 mx-auto mb-3" : "text-gray-400 mx-auto mb-3"} />
                    <p className={isDarkTheme ? "text-white/70" : "text-gray-700"}>
                      Drag and drop a file or paste text here
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
