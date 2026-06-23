export type AnalysisSections = {
  summary: string;
  keyPoints: string;
  risksActions: string;
};

export function parseAnalysisSections(content: string): AnalysisSections {
  const summaryStart = content.indexOf("SUMMARY:");
  const keyStart = content.indexOf("KEY_POINTS:");
  const riskStart = content.indexOf("RISKS_ACTIONS:");

  // If the model repeats the whole block per document, the next "SUMMARY:"
  // marks the start of another block — Risks must stop there instead of
  // swallowing every following document's content.
  const nextBlock = riskStart === -1 ? -1 : content.indexOf("SUMMARY:", riskStart + 1);

  return {
    summary: sliceSection(content, summaryStart, "SUMMARY:", firstAfter(summaryStart, [keyStart, riskStart])),
    keyPoints: sliceSection(content, keyStart, "KEY_POINTS:", firstAfter(keyStart, [riskStart])),
    risksActions: sliceSection(content, riskStart, "RISKS_ACTIONS:", nextBlock),
  };
}

// Smallest candidate index strictly greater than `start`, or -1 (end of string).
function firstAfter(start: number, candidates: number[]) {
  const valid = candidates.filter((index) => index > start);
  return valid.length ? Math.min(...valid) : -1;
}

function sliceSection(content: string, start: number, label: string, end: number) {
  if (start === -1) return "";
  const from = start + label.length;
  return content.slice(from, end === -1 ? undefined : end).trim();
}

export function normalizeBullets(value: string) {
  return value
    .split("\n")
    // Strip a leading list marker (-, --, *, •, –, — or "1." / "1)") only when
    // followed by whitespace, so inline **bold** at the start is preserved.
    .map((line) => line.replace(/^\s*(?:[-*•–—]+|\d+[.)])\s+/, "").trim())
    .filter(Boolean);
}
