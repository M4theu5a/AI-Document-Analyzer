import { normalizeBullets, type AnalysisSections } from "@/lib/analysis";
import { parseRiskGroups } from "@/lib/risk-groups";

type ExportChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type ExportDocumentPart = {
  fileName: string;
  text: string;
};

type ExportChatSession = {
  id: string;
  title: string;
  documentName: string;
  documentText: string;
  documents: ExportDocumentPart[];
  messages: ExportChatMessage[];
};

export function buildAnalysisExport(
  documentName: string,
  sections: AnalysisSections,
  rawAnalysis: string,
) {
  if (!rawAnalysis.trim()) return "";
  const generatedAt = new Date().toLocaleString();
  return `# Document Intelligence Review\n\nDocument: ${documentName}\nGenerated: ${generatedAt}\n\n## Summary\n\n${sections.summary || "No summary was generated."}\n\n## Key Points\n\n${formatMarkdownBullets(sections.keyPoints)}\n\n## Risks & Actions\n\n${formatMarkdownBullets(sections.risksActions)}\n`;
}

export function buildAnalysisJsonExport(
  documentName: string,
  sections: AnalysisSections,
  rawAnalysis: string,
) {
  return {
    documentName,
    exportedAt: new Date().toISOString(),
    summary: sections.summary,
    keyPoints: normalizeBullets(sections.keyPoints),
    risksAndActions: parseRiskGroups(sections.risksActions).map((group) => ({
      title: group.title,
      items: group.items,
    })),
    rawAnalysis,
  };
}

export function buildChatExport(chat?: ExportChatSession) {
  if (!chat?.messages.length) return "";
  const generatedAt = new Date().toLocaleString();
  const messages = chat.messages
    .map((m) => `### ${m.role === "user" ? "User" : "Assistant"}\n\n${m.content}`)
    .join("\n\n");
  return `# Document Export\n\nDocument: ${chat.documentName}\nGenerated: ${generatedAt}\n\n${messages}\n`;
}

export function buildChatJsonExport(chat: ExportChatSession) {
  return {
    id: chat.id,
    title: chat.title.trim() || firstDocumentName(chat) || chat.documentName || "Untitled document",
    documentName: chat.documentName,
    documents: currentExportDocuments(chat).map((document) => ({
      fileName: document.fileName,
      characters: document.text.trim().length,
    })),
    exportedAt: new Date().toISOString(),
    messages: chat.messages,
  };
}

export async function downloadPdf(content: string, fileName: string, title: string) {
  if (!content.trim()) return;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ format: "a4", unit: "pt" });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;
  doc.setProperties({ title, subject: "Document Intelligence Workspace export", creator: "Document Intelligence Workspace" });
  for (const rawLine of content.split("\n")) {
    const line = sanitizePdfText(rawLine).trimEnd();
    if (!line.trim()) {
      y += 10;
      continue;
    }
    const style = getPdfLineStyle(line);
    const printableLine = line.replace(/^#{1,3}\s*/, "");
    doc.setFont("helvetica", style.weight);
    doc.setFontSize(style.size);
    const wrappedLines = doc.splitTextToSize(printableLine, maxWidth) as string[];
    const lineHeight = style.size + 6;
    const blockHeight = wrappedLines.length * lineHeight;
    if (y + blockHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    for (const wrappedLine of wrappedLines) {
      doc.text(wrappedLine, margin, y);
      y += lineHeight;
    }
    y += style.after;
  }
  doc.save(fileName);
}

export function downloadJson(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function toFileSlug(value: string) {
  const slug = value
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "document";
}

function formatMarkdownBullets(content: string) {
  const bullets = normalizeBullets(content);
  return bullets.length ? bullets.map((bullet) => `- ${bullet}`).join("\n") : "No items were generated.";
}

function currentExportDocuments(session: ExportChatSession): ExportDocumentPart[] {
  if (session.documents?.length) return session.documents;
  if (session.documentText.trim()) {
    return [{ fileName: session.documentName, text: session.documentText }];
  }
  return [];
}

function firstDocumentName(chat: ExportChatSession) {
  return chat.documents[0]?.fileName;
}

function sanitizePdfText(value: string) {
  const replacements: Record<string, string> = {
    "\u00a0": " ",
    "\u00ad": "",
    "\u2010": "-",
    "\u2011": "-",
    "\u2012": "-",
    "\u2013": "-",
    "\u2014": "-",
    "\u2015": "-",
    "\u2018": "'",
    "\u2019": "'",
    "\u201a": "'",
    "\u201c": "\"",
    "\u201d": "\"",
    "\u201e": "\"",
    "\u2022": "-",
    "\u2026": "...",
    "\u2212": "-",
  };

  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/[\u00a0\u00ad\u2010-\u2015\u2018-\u201a\u201c-\u201e\u2022\u2026\u2212]/g, (char) => replacements[char] ?? "")
    .replace(/[^\u0009\u000a\u000d\u0020-\u007e\u00a1-\u00ff]/g, (char) => {
      const fallback = char.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return /^[\u0020-\u007e\u00a1-\u00ff]+$/.test(fallback) ? fallback : "";
    });
}

function getPdfLineStyle(line: string) {
  if (line.startsWith("# ")) return { size: 18, weight: "bold" as const, after: 8 };
  if (line.startsWith("## ")) return { size: 14, weight: "bold" as const, after: 6 };
  if (line.startsWith("### ")) return { size: 12, weight: "bold" as const, after: 4 };
  return { size: 10, weight: "normal" as const, after: 2 };
}
