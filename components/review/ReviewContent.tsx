"use client";

import {
  KeyIcon as Key,
  WarningDiamondIcon as WarningDiamond,
} from "@phosphor-icons/react";
import type React from "react";
import { normalizeBullets } from "@/lib/analysis";
import { buildRiskListEntries } from "@/lib/risk-groups";

type ReviewContentProps = {
  content: string;
  isLoading: boolean;
};

export function SummaryContent({ content, isLoading }: ReviewContentProps) {
  if (content) {
    return (
      <p className="fade-in-up whitespace-pre-wrap text-[13px] leading-[1.6] text-text">
        {renderInline(content)}
        {isLoading && <StreamingCursor />}
      </p>
    );
  }

  return isLoading ? <SkeletonLines /> : <EmptyTabState />;
}

export function KeyPointsList({ content, isLoading }: ReviewContentProps) {
  const bullets = normalizeBullets(content);
  if (!bullets.length) {
    return isLoading ? <SkeletonLines /> : <EmptyTabState />;
  }
  return (
    <ul className="fade-in-up space-y-2">
      {bullets.map((bullet, index) => (
        <li
          key={bullet}
          className="flex items-start gap-3 rounded-[11px] border border-border"
          style={{ padding: "10px 14px", background: "var(--inset)" }}
        >
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-[8px]"
            style={{
              color: "var(--ok)",
              background: "color-mix(in oklab, var(--ok) 12%, transparent)",
              border: "1px solid color-mix(in oklab, var(--ok) 22%, transparent)",
            }}
            aria-hidden
          >
            <Key className="size-3.5" weight="bold" />
          </span>
          <span className="text-[13px] leading-[1.5] text-text flex-1 min-w-0">
            {renderInline(bullet)}
            {isLoading && index === bullets.length - 1 && <StreamingCursor />}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function RisksList({ content, isLoading }: ReviewContentProps) {
  const bullets = normalizeBullets(content);
  if (!bullets.length) {
    return isLoading ? <SkeletonLines /> : <EmptyTabState />;
  }
  const entries = buildRiskListEntries(bullets);
  return (
    <ul className="fade-in-up space-y-2.5">
      {entries.map((entry, index) => {
        if (entry.type === "heading") {
          return (
            <li
              key={`${entry.heading.label}-${index}`}
              className="pt-4 first:pt-0"
            >
              <span
                className="block text-[14px] font-bold text-text"
                style={{
                  color: entry.heading.color,
                }}
              >
                {entry.heading.label}
              </span>
            </li>
          );
        }

        return (
          <li
            key={`${entry.text}-${index}`}
            className="flex items-start gap-2.5 rounded-[11px] border px-3.5 py-2.5"
            style={{
              borderColor: `color-mix(in oklab, ${entry.color} 22%, transparent)`,
              background: `color-mix(in oklab, ${entry.color} 6%, transparent)`,
            }}
          >
            <WarningDiamond
              className="size-4 shrink-0 mt-[3px]"
              style={{ color: entry.color }}
              weight="fill"
              aria-hidden
            />
            <span className="text-[13px] leading-[1.6] text-text">
              {renderInline(entry.text)}
              {isLoading && index === entries.length - 1 && <StreamingCursor />}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyTabState() {
  return (
    <p className="text-[13.5px] text-muted">
      Run an analysis to populate this section.
    </p>
  );
}

function SkeletonLines() {
  return (
    <div className="space-y-3" aria-label="Loading content">
      <div className="skeleton-line w-11/12" />
      <div className="skeleton-line w-full" />
      <div className="skeleton-line w-9/12" />
      <div className="skeleton-line w-7/12" />
    </div>
  );
}

export function StreamingCursor() {
  return <span aria-hidden className="streaming-cursor" />;
}

// Renders the small inline markdown subset emitted by the model.
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-inset px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}
