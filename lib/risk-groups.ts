import { normalizeBullets } from "@/lib/analysis";

export type RiskSectionHeading = {
  label: string;
  color: string;
};

export type RiskListEntry =
  | { type: "heading"; heading: RiskSectionHeading }
  | { type: "item"; text: string; color: string };

export function buildRiskListEntries(bullets: string[]): RiskListEntry[] {
  const entries: RiskListEntry[] = [];
  let currentHeading = getRiskSectionHeading("Risks");

  for (const bullet of bullets) {
    const section = splitRiskSectionPrefix(bullet);

    if (section) {
      currentHeading = section.heading;
      pushRiskHeading(entries, section.heading);
      splitRiskSectionItems(section.body).forEach((item) => {
        entries.push({ type: "item", text: item, color: section.heading.color });
      });
      continue;
    }

    const heading = getRiskSectionHeading(bullet);
    if (heading) {
      currentHeading = heading;
      pushRiskHeading(entries, heading);
      continue;
    }

    entries.push({
      type: "item",
      text: bullet,
      color: currentHeading?.color ?? "var(--danger)",
    });
  }

  return entries;
}

export function parseRiskGroups(content: string) {
  const groups: Array<{ title: string; items: string[] }> = [];
  let currentGroup: { title: string; items: string[] } | null = null;

  for (const entry of buildRiskListEntries(normalizeBullets(content))) {
    if (entry.type === "heading") {
      currentGroup = { title: entry.heading.label, items: [] };
      groups.push(currentGroup);
      continue;
    }

    if (!currentGroup) {
      currentGroup = { title: "Risks", items: [] };
      groups.push(currentGroup);
    }
    currentGroup.items.push(entry.text);
  }

  return groups.filter((group) => group.items.length > 0);
}

function pushRiskHeading(entries: RiskListEntry[], heading: RiskSectionHeading) {
  const last = entries[entries.length - 1];
  if (last?.type === "heading" && last.heading.label === heading.label) return;
  entries.push({ type: "heading", heading });
}

function splitRiskSectionPrefix(text: string) {
  const clean = text.replace(/\*\*/g, "").trim();
  const separatorIndex = clean.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex > 42) return null;

  const label = clean.slice(0, separatorIndex).trim();
  if (!label || /[.!?]/.test(label)) return null;

  const heading = getRiskSectionHeading(label);
  if (!heading) return null;

  const body = clean.slice(separatorIndex + 1).trim();
  return body ? { heading, body } : null;
}

function splitRiskSectionItems(text: string) {
  const questionParts = text.match(/[^?]+(?:\?|$)/g);
  const pieces = text.includes("?") && questionParts ? questionParts : text.split(";");
  return pieces.map((piece) => piece.trim()).filter(Boolean);
}

function getRiskSectionHeading(text: string) {
  const clean = text.replace(/\*\*/g, "").trim();
  const normalized = text
    .replace(/\*\*/g, "")
    .replace(/:$/, "")
    .trim()
    .toLowerCase();

  if (["risk", "risks", "key risks", "identified risks", "potential risks"].includes(normalized)) {
    return { label: "Risks", color: "var(--danger)" };
  }

  if (["missing information", "missing info", "information gaps", "gaps"].includes(normalized)) {
    return { label: "Missing information", color: "var(--warning)" };
  }

  if (["follow-up question", "follow-up questions", "follow up question", "follow up questions"].includes(normalized)) {
    return { label: "Follow-up questions", color: "var(--accent)" };
  }

  if (["suggested next action", "suggested next actions", "suggested actions"].includes(normalized)) {
    return { label: "Suggested next actions", color: "var(--accent)" };
  }

  if (
    [
      "action",
      "actions",
      "recommended action",
      "recommended actions",
      "next action",
      "next actions",
      "mitigation",
      "mitigations",
    ].includes(normalized)
  ) {
    return { label: "Actions", color: "var(--accent)" };
  }

  if (clean.endsWith(":") && clean.length <= 42 && !/[.!?]/.test(clean.slice(0, -1))) {
    return {
      label: clean.slice(0, -1).trim(),
      color: "var(--text-muted)",
    };
  }

  return null;
}
