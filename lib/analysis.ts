export type AnalysisSections = {
  summary: string;
  keyPoints: string;
  risksActions: string;
};

export function parseAnalysisSections(content: string): AnalysisSections {
  const summary = extractSection(content, "SUMMARY", "KEY_POINTS");
  const keyPoints = extractSection(content, "KEY_POINTS", "RISKS_ACTIONS");
  const risksActions = extractSection(content, "RISKS_ACTIONS");

  return {
    summary,
    keyPoints,
    risksActions,
  };
}

function extractSection(content: string, start: string, end?: string) {
  const startIndex = content.indexOf(`${start}:`);

  if (startIndex === -1) {
    return "";
  }

  const contentStart = startIndex + start.length + 1;
  const contentEnd = end ? content.indexOf(`${end}:`, contentStart) : -1;

  return content
    .slice(contentStart, contentEnd === -1 ? undefined : contentEnd)
    .trim();
}

export function normalizeBullets(value: string) {
  return value
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}
