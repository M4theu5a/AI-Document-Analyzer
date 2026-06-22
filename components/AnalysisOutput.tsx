"use client";

import React, { FormEvent, useState } from "react";
import { Copy, Check, MessageSquare, Send } from "lucide-react";
import { StreamingCursor } from "./StreamingCursor";
import { SkeletonLoader } from "./SkeletonLoader";

interface AnalysisOutputProps {
  isDarkTheme: boolean;
  isLoading: boolean;
  isAnswering: boolean;
  content: string;
  tabId: "summary" | "keyPoints" | "qa";
  error?: string;
  onQuestion?: (question: string) => void;
}

export function AnalysisOutput({
  isDarkTheme,
  isLoading,
  isAnswering,
  content,
  tabId,
  error,
  onQuestion,
}: AnalysisOutputProps) {
  const [copied, setCopied] = useState(false);
  const [question, setQuestion] = useState("");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmitQuestion = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (question.trim() && onQuestion) {
      onQuestion(question);
      setQuestion("");
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className={`px-6 py-4 border-b ${isDarkTheme ? "border-white/10" : "border-gray-200"} flex items-center justify-between`}>
        <h2 className={`font-semibold ${isDarkTheme ? "text-white" : "text-gray-900"}`}>Analysis Output</h2>
        {content && !isLoading && (
          <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm ${
              isDarkTheme
                ? "hover:bg-white/10 text-white/70 hover:text-white"
                : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
            }`}
          >
            {copied ? (
              <>
                <Check size={16} />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {error ? (
          <div className={`p-4 rounded-lg ${isDarkTheme ? "bg-red-500/10 border border-red-500/30" : "bg-red-50 border border-red-200"}`}>
            <p className={isDarkTheme ? "text-red-400" : "text-red-700"}>{error}</p>
          </div>
        ) : isLoading ? (
          <SkeletonLoader />
        ) : content ? (
          <div className={`prose prose-invert max-w-none ${isDarkTheme ? "text-white/90" : "text-gray-900"} fade-in-up`}>
            {/* Parse content for better display */}
            {content.split("\n").map((paragraph, idx) => {
              if (!paragraph.trim()) return null;

              if (paragraph.trim().startsWith("-") || paragraph.trim().startsWith("•")) {
                return (
                  <p key={idx} className="ml-4 my-2 flex gap-3">
                    <span className={isDarkTheme ? "text-doc-purple-light" : "text-doc-purple"}>•</span>
                    <span>{paragraph.replace(/^[-•]\s*/, "")}</span>
                  </p>
                );
              }

              return (
                <p key={idx} className="my-3 leading-relaxed">
                  {paragraph}
                </p>
              );
            })}

            {isAnswering && <StreamingCursor />}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageSquare size={48} className={isDarkTheme ? "text-white/30 mx-auto mb-3" : "text-gray-400 mx-auto mb-3"} />
              <p className={isDarkTheme ? "text-white/50" : "text-gray-500"}>
                Click "Analyze" to generate output
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Q&A Section */}
      {tabId === "qa" && (
        <div className={`border-t px-6 py-4 ${isDarkTheme ? "border-white/10" : "border-gray-200"}`}>
          <form onSubmit={handleSubmitQuestion} className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about the document..."
              className={`flex-1 px-4 py-2 rounded-lg outline-none transition-all ${
                isDarkTheme
                  ? "bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-doc-purple/50 focus:bg-white/10"
                  : "bg-gray-100 border border-gray-300 text-gray-900 placeholder-gray-500 focus:border-doc-purple focus:bg-white"
              }`}
              disabled={isAnswering}
            />
            <button
              type="submit"
              disabled={!question.trim() || isAnswering}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
                isDarkTheme
                  ? "bg-doc-purple hover:bg-doc-purple/90 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                  : "bg-doc-purple hover:bg-doc-purple/90 disabled:opacity-50 disabled:cursor-not-allowed text-white"
              }`}
            >
              <Send size={16} />
              <span>Send</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
