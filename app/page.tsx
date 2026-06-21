"use client";

import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Upload,
  Workflow,
} from "lucide-react";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { normalizeBullets, parseAnalysisSections } from "@/lib/analysis";

type IntakeMode = "upload" | "paste";
type ResultTab = "summary" | "keyPoints" | "risksActions";

const tabs: Array<{ id: ResultTab; label: string; helper: string }> = [
  {
    id: "summary",
    label: "Summary",
    helper: "Executive-level explanation of what the document says.",
  },
  {
    id: "keyPoints",
    label: "Key Points",
    helper: "Facts, obligations, names, dates, values, and decisions.",
  },
  {
    id: "risksActions",
    label: "Risks & Actions",
    helper: "Follow-ups, missing data, risk signals, and next steps.",
  },
];

const sampleText = `Service Agreement

Client: BankX Digital Services
Vendor: Xenet AI Solutions
Effective date: 1 March 2026
Payment terms: Net 30 after invoice receipt.

The vendor will deliver an AI-powered document processing workflow for invoice intake, validation, summary generation, and exception routing. The service must process uploaded PDF invoices and flag missing supplier IDs, tax mismatches, duplicated invoice numbers, and payment deadlines within five business days.

The contract includes a 99.5% monthly uptime target. Customer data must remain encrypted in transit and at rest. Any subprocessors must be disclosed before production use. The first pilot milestone is due on 15 April 2026.`;

export default function Home() {
  const [intakeMode, setIntakeMode] = useState<IntakeMode>("upload");
  const [documentText, setDocumentText] = useState("");
  const [documentName, setDocumentName] = useState("No document loaded");
  const [rawAnalysis, setRawAnalysis] = useState("");
  const [activeTab, setActiveTab] = useState<ResultTab>("summary");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sections = useMemo(() => parseAnalysisSections(rawAnalysis), [rawAnalysis]);
  const currentTab = tabs.find((tab) => tab.id === activeTab)!;
  const currentContent = sections[activeTab];
  const completionScore = [sections.summary, sections.keyPoints, sections.risksActions].filter(
    Boolean,
  ).length;
  const hasAnalysis = Boolean(rawAnalysis.trim());
  const hasAnswer = Boolean(answer.trim());
  const analysisExport = useMemo(
    () => buildAnalysisExport(documentName, sections, rawAnalysis),
    [documentName, rawAnalysis, sections],
  );
  const answerExport = useMemo(
    () => buildAnswerExport(documentName, question, answer),
    [answer, documentName, question],
  );

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError("");
    setIsExtracting(true);
    setDocumentName(file.name);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as { text?: string; error?: string };

      if (!response.ok || !payload.text) {
        throw new Error(payload.error || "Could not extract text from the document.");
      }

      setDocumentText(payload.text);
      setRawAnalysis("");
      setAnswer("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Document upload failed.");
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleAnalyze() {
    if (!documentText.trim()) {
      setError("Upload a document or paste text before analysis.");
      return;
    }

    setError("");
    setRawAnalysis("");
    setAnswer("");
    setIsAnalyzing(true);

    try {
      await streamFromApi(
        "/api/analyze",
        {
          mode: "analysis",
          documentText,
        },
        (chunk) => setRawAnalysis((previous) => previous + chunk),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!documentText.trim()) {
      setError("Load a document before asking questions.");
      return;
    }

    if (!question.trim()) {
      setError("Write a question first.");
      return;
    }

    setError("");
    setAnswer("");
    setIsAnswering(true);

    try {
      await streamFromApi(
        "/api/analyze",
        {
          mode: "question",
          documentText,
          question,
        },
        (chunk) => setAnswer((previous) => previous + chunk),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Question failed.");
    } finally {
      setIsAnswering(false);
    }
  }

  function loadSample() {
    setIntakeMode("paste");
    setDocumentName("sample-service-agreement.txt");
    setDocumentText(sampleText);
    setRawAnalysis("");
    setAnswer("");
    setError("");
  }

  function exportAnalysis() {
    downloadMarkdown(analysisExport, `${toFileSlug(documentName)}-analysis.md`);
  }

  function exportAnswer() {
    downloadMarkdown(answerExport, `${toFileSlug(documentName)}-qa.md`);
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-white/80 bg-white/75 p-5 shadow-soft backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-white">
              <Sparkles className="size-6" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-xen-indigo">
                Intelligent Document Processing
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                AI Document Analyzer
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Upload a PDF or paste text, then stream a business-ready analysis with
                summaries, key points, risk signals.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs text-slate-600 sm:min-w-80">
            <StatusPill icon={<ShieldCheck className="size-4" />} label="Secure intake" />
            <StatusPill icon={<Workflow className="size-4" />} label="Workflow ready" />
            <StatusPill icon={<Bot className="size-4" />} label="LLM streaming" />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="rounded-3xl border border-white/80 bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">Document intake</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Start with PDF upload or paste raw text from a contract, invoice, or policy.
                </p>
              </div>
              <FileText className="size-6 text-xen-indigo" />
            </div>

            <div className="mt-5 grid grid-cols-2 rounded-full bg-slate-100 p-1">
              <button
                className={modeButtonClass(intakeMode === "upload")}
                onClick={() => setIntakeMode("upload")}
                type="button"
              >
                Upload PDF
              </button>
              <button
                className={modeButtonClass(intakeMode === "paste")}
                onClick={() => setIntakeMode("paste")}
                type="button"
              >
                Paste text
              </button>
            </div>

            {intakeMode === "upload" ? (
              <div className="mt-5">
                <button
                  className="flex min-h-44 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/60 p-6 text-center transition hover:border-xen-indigo hover:bg-indigo-50"
                  disabled={isExtracting}
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  {isExtracting ? (
                    <Loader2 className="size-8 animate-spin text-xen-indigo" />
                  ) : (
                    <Upload className="size-8 text-xen-indigo" />
                  )}
                  <span className="mt-3 font-semibold text-ink">
                    {isExtracting ? "Extracting document text" : "Choose a PDF, TXT, or Markdown file"}
                  </span>
                  <span className="mt-1 text-sm text-slate-600">Maximum 8 MB</span>
                </button>
                <input
                  ref={fileInputRef}
                  accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                  className="hidden"
                  onChange={handleFileChange}
                  type="file"
                />
              </div>
            ) : (
              <textarea
                className="mt-5 min-h-56 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-ink outline-none transition focus:border-xen-indigo focus:bg-white focus:ring-4 focus:ring-indigo-100"
                onChange={(event) => {
                  setDocumentText(event.target.value);
                  setDocumentName("pasted-document.txt");
                }}
                placeholder="Paste document text here..."
                value={documentText}
              />
            )}

            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{documentName}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {documentText.trim()
                      ? `${documentText.trim().length.toLocaleString()} characters ready`
                      : "No text extracted yet"}
                  </p>
                </div>
                {documentText.trim() ? (
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                ) : null}
              </div>
            </div>

            {error ? (
              <div className="mt-4 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <AlertCircle className="mt-0.5 size-5 shrink-0" />
                <p>{error}</p>
              </div>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
              <button
                className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isAnalyzing || isExtracting || !documentText.trim()}
                onClick={handleAnalyze}
                type="button"
              >
                {isAnalyzing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Analyze document
              </button>
              <button
                className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-ink transition hover:border-xen-indigo hover:text-xen-indigo"
                onClick={loadSample}
                type="button"
              >
                Load sample
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-white/80 bg-white p-5 shadow-soft">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">Analysis workspace</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Results stream in as the LLM works through the document.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
                  {completionScore}/3 sections ready
                </div>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-xen-indigo hover:text-xen-indigo disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!hasAnalysis || isAnalyzing}
                  onClick={exportAnalysis}
                  type="button"
                >
                  <Download className="size-4" />
                  Export analysis
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {tabs.map((tab) => (
                <button
                  className={`rounded-2xl border p-4 text-left transition ${
                    activeTab === tab.id
                      ? "border-xen-indigo bg-indigo-50 text-ink"
                      : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200"
                  }`}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                >
                  <span className="block text-sm font-semibold">{tab.label}</span>
                  <span className="mt-1 block text-xs leading-5">{tab.helper}</span>
                </button>
              ))}
            </div>

            <article className="mt-5 min-h-72 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-ink">{currentTab.label}</h3>
                {isAnalyzing ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-xen-indigo">
                    <Loader2 className="size-3.5 animate-spin" />
                    Streaming
                  </span>
                ) : null}
              </div>

              <div className="mt-4 text-sm leading-7 text-slate-700">
                {activeTab === "summary" ? (
                  <p className="whitespace-pre-wrap">
                    {currentContent || emptyResultText(isAnalyzing)}
                  </p>
                ) : (
                  <BulletList content={currentContent} isLoading={isAnalyzing} />
                )}
              </div>
            </article>

            <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-xen-purple text-white">
                  <MessageSquareText className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-ink">Ask the document</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Ask follow-up questions grounded only in the uploaded or pasted content.
                  </p>
                </div>
                </div>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-ink transition hover:border-xen-indigo hover:text-xen-indigo disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!hasAnswer || isAnswering}
                  onClick={exportAnswer}
                  type="button"
                >
                  <Download className="size-4" />
                  Export answer
                </button>
              </div>

              <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleQuestion}>
                <input
                  className="min-h-12 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-ink outline-none transition focus:border-xen-indigo focus:bg-white focus:ring-4 focus:ring-indigo-100"
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Example: What risks should the finance team review?"
                  value={question}
                />
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-xen-indigo px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isAnswering || !documentText.trim()}
                  type="submit"
                >
                  {isAnswering ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                  Ask
                </button>
              </form>

              <div className="mt-4 min-h-24 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                <p className="whitespace-pre-wrap">
                  {answer ||
                    (isAnswering
                      ? "Reading the document..."
                      : "Your answer will stream here after you ask a question.")}
                </p>
              </div>
            </section>
          </section>
        </div>
      </section>
    </main>
  );
}

function StatusPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-white px-3 py-2 shadow-sm">
      <span className="text-xen-indigo">{icon}</span>
      <span className="font-medium">{label}</span>
    </div>
  );
}

function BulletList({ content, isLoading }: { content: string; isLoading: boolean }) {
  const bullets = normalizeBullets(content);

  if (!bullets.length) {
    return <p>{emptyResultText(isLoading)}</p>;
  }

  return (
    <ul className="space-y-3">
      {bullets.map((bullet) => (
        <li className="flex gap-3" key={bullet}>
          <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-600" />
          <span>{bullet}</span>
        </li>
      ))}
    </ul>
  );
}

async function streamFromApi(
  url: string,
  body: Record<string, unknown>,
  onChunk: (chunk: string) => void,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    throw new Error(await response.text());
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedText = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    const chunk = decoder.decode(value, { stream: true });
    receivedText += chunk;
    onChunk(chunk);
  }

  if (!receivedText.trim()) {
    throw new Error("The analysis finished without returning text. Please try again.");
  }
}

function modeButtonClass(isActive: boolean) {
  return `rounded-full px-4 py-2 text-sm font-semibold transition ${
    isActive ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink"
  }`;
}

function emptyResultText(isLoading: boolean) {
  return isLoading ? "Waiting for this section..." : "Run an analysis to populate this section.";
}

function buildAnalysisExport(
  documentName: string,
  sections: ReturnType<typeof parseAnalysisSections>,
  rawAnalysis: string,
) {
  const generatedAt = new Date().toLocaleString();

  if (!rawAnalysis.trim()) {
    return "";
  }

  return `# AI Document Analysis

Document: ${documentName}
Generated: ${generatedAt}

## Summary

${sections.summary || "No summary was generated."}

## Key Points

${formatMarkdownBullets(sections.keyPoints)}

## Risks & Actions

${formatMarkdownBullets(sections.risksActions)}
`;
}

function buildAnswerExport(documentName: string, question: string, answer: string) {
  const generatedAt = new Date().toLocaleString();

  if (!answer.trim()) {
    return "";
  }

  return `# Document Q&A

Document: ${documentName}
Generated: ${generatedAt}

## Question

${question || "No question was recorded."}

## Answer

${answer}
`;
}

function formatMarkdownBullets(content: string) {
  const bullets = normalizeBullets(content);

  if (!bullets.length) {
    return "No items were generated.";
  }

  return bullets.map((bullet) => `- ${bullet}`).join("\n");
}

function downloadMarkdown(content: string, fileName: string) {
  if (!content.trim()) {
    return;
  }

  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toFileSlug(value: string) {
  const slug = value
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "document";
}
