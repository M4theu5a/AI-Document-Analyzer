"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { Sidebar } from "@/components/Sidebar";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { DocumentInput } from "@/components/DocumentInput";
import { AnalysisOutput } from "@/components/AnalysisOutput";
import { TabBar, TabId } from "@/components/TabBar";

interface RecentDocument {
  id: string;
  filename: string;
  preview: string;
  timestamp: string;
}

interface ChatSession {
  id: string;
  documentName: string;
  documentText: string;
  analysis: string;
  createdAt: Date;
  updatedAt: Date;
}

const STORAGE_KEY = "doc-analyzer-sessions";
const THEME_KEY = "doc-analyzer-theme";

const tabs = [
  { id: "summary" as TabId, label: "Summary", description: "Executive-level overview" },
  { id: "keyPoints" as TabId, label: "Key Points", description: "Facts, dates, and decisions" },
  { id: "qa" as TabId, label: "Q&A", description: "Ask specific questions" },
];

export default function Home() {
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [documentText, setDocumentText] = useState("");
  const [documentName, setDocumentName] = useState("No document loaded");
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [analysisOutput, setAnalysisOutput] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [recentDocuments, setRecentDocuments] = useState<RecentDocument[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load theme from storage
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light") {
      setIsDarkTheme(false);
    }
  }, []);

  // Load sessions from storage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ChatSession[];
        setSessions(parsed);
        updateRecentDocuments(parsed);
      } catch {
        setSessions([]);
      }
    }
  }, []);

  // Save sessions to storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  // Save theme to storage
  useEffect(() => {
    localStorage.setItem(THEME_KEY, isDarkTheme ? "dark" : "light");
  }, [isDarkTheme]);

  const updateRecentDocuments = (sessionList: ChatSession[]) => {
    const recent = sessionList
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 8)
      .map((session) => ({
        id: session.id,
        filename: session.documentName,
        preview: session.analysis.substring(0, 60) + "...",
        timestamp: formatRelativeTime(new Date(session.updatedAt)),
      }));
    setRecentDocuments(recent);
  };

  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const wordCount = documentText.split(/\s+/).filter((w) => w).length;
  const charCount = documentText.length;

  const handleNewDocument = () => {
    setDocumentText("");
    setDocumentName("New Document");
    setAnalysisOutput("");
    setActiveTab("summary");
    setError("");
  };

  const handleFileSelect = async (files: FileList) => {
    if (!files.length) return;

    const file = files[0];
    setIsExtracting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("files", file);

      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.text) {
        throw new Error(data.error || "Failed to extract text");
      }

      setDocumentName(file.name);
      setDocumentText(data.text);
      setAnalysisOutput("");

      // Save to sessions
      const newSession: ChatSession = {
        id: Date.now().toString(),
        documentName: file.name,
        documentText: data.text,
        analysis: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setSessions([newSession, ...sessions]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process file");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleTextChange = (text: string) => {
    setDocumentText(text);
  };

  const handleAnalyze = async () => {
    if (!documentText.trim()) {
      setError("Please upload or paste a document first");
      return;
    }

    setError("");
    setAnalysisOutput("");
    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentText,
          mode: "analysis",
        }),
      });

      if (!response.ok) {
        throw new Error("Analysis failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        fullText += chunk;
        setAnalysisOutput(fullText);
      }

      // Update session with analysis
      setSessions((prev) =>
        prev.map((session) =>
          session.documentName === documentName
            ? { ...session, analysis: fullText, updatedAt: new Date() }
            : session
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleQuestion = async (question: string) => {
    if (!documentText.trim()) {
      setError("Please load a document first");
      return;
    }

    setIsAnswering(true);
    setError("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentText,
          question,
          mode: "question",
        }),
      });

      if (!response.ok) throw new Error("Question failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let answer = analysisOutput;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value);
        setAnalysisOutput(answer);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to answer question");
    } finally {
      setIsAnswering(false);
    }
  };

  const handleSelectDocument = (id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (session) {
      setDocumentName(session.documentName);
      setDocumentText(session.documentText);
      setAnalysisOutput(session.analysis);
      setActiveTab("summary");
    }
  };

  const handleDeleteDocument = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    updateRecentDocuments(sessions.filter((s) => s.id !== id));
  };

  const hasDocument = documentText.trim().length > 0;

  return (
    <div className={isDarkTheme ? "dark-theme" : ""}>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          onNewDocument={handleNewDocument}
          onSelectDocument={handleSelectDocument}
          recentDocuments={recentDocuments}
          isDarkTheme={isDarkTheme}
          onThemeToggle={() => setIsDarkTheme(!isDarkTheme)}
          onSearchChange={() => {}}
          onDeleteDocument={handleDeleteDocument}
        />

        {/* Main Content */}
        <main className={`flex-1 ml-60 overflow-hidden ${isDarkTheme ? "dark-theme" : ""}`}>
          {!hasDocument ? (
            <WelcomeScreen
              isDarkTheme={isDarkTheme}
              onUploadClick={() => fileInputRef.current?.click()}
            />
          ) : (
            <div className="h-full flex flex-col">
              {/* Analyze Button */}
              <div className={`px-6 py-4 border-b flex items-center justify-between ${
                isDarkTheme ? "border-white/10 bg-doc-dark/50" : "border-gray-200"
              }`}>
                <h1 className={isDarkTheme ? "text-white font-semibold" : "text-gray-900 font-semibold"}>
                  Document Analysis
                </h1>
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !documentText.trim()}
                  className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                    documentText.trim() && !isAnalyzing
                      ? isDarkTheme
                        ? "bg-doc-purple hover:shadow-[0_0_40px_rgba(127,119,221,0.8)] text-white"
                        : "bg-doc-purple text-white hover:bg-doc-purple/90"
                      : "opacity-50 cursor-not-allowed"
                  } ${isDarkTheme ? "text-white" : ""}`}
                >
                  {isAnalyzing ? "Analyzing..." : "Analyze"}
                </button>
              </div>

              {/* Tabs */}
              <TabBar
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                isDarkTheme={isDarkTheme}
              />

              {/* Two-Panel Layout */}
              <div className="flex-1 overflow-hidden flex">
                {/* Left Panel - Document Input */}
                <div className={`w-1/2 border-r overflow-hidden ${isDarkTheme ? "border-white/10" : "border-gray-200"}`}>
                  <DocumentInput
                    isDarkTheme={isDarkTheme}
                    documentName={documentName}
                    documentText={documentText}
                    wordCount={wordCount}
                    charCount={charCount}
                    isExtracting={isExtracting}
                    error={error}
                    onFileSelect={handleFileSelect}
                    onTextChange={handleTextChange}
                  />
                </div>

                {/* Right Panel - Analysis Output */}
                <div className="w-1/2 overflow-hidden">
                  <AnalysisOutput
                    isDarkTheme={isDarkTheme}
                    isLoading={isAnalyzing}
                    isAnswering={isAnswering}
                    content={analysisOutput}
                    tabId={activeTab}
                    error={error}
                    onQuestion={activeTab === "qa" ? handleQuestion : undefined}
                  />
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={(e) => handleFileSelect(e.currentTarget.files!)}
          accept=".pdf,.doc,.docx,.txt"
          className="hidden"
        />
      </div>
    </div>
  );
}
