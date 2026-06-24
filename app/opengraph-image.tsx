import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Document Intelligence Workspace preview";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#080D14",
          color: "#F8FBFF",
          display: "flex",
          fontFamily: "Arial, sans-serif",
          height: "100%",
          justifyContent: "center",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            background:
              "radial-gradient(circle at center, rgba(56, 189, 248, 0.24), rgba(139, 92, 246, 0.12) 34%, transparent 62%)",
            height: 620,
            left: 290,
            position: "absolute",
            top: -130,
            width: 620,
          }}
        />
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            gap: 26,
            position: "relative",
            textAlign: "center",
          }}
        >
          <div
            style={{
              alignItems: "center",
              background: "linear-gradient(135deg, #38BDF8, #2563EB)",
              borderRadius: 24,
              boxShadow: "0 22px 80px rgba(37, 99, 235, 0.45)",
              display: "flex",
              height: 96,
              justifyContent: "center",
              width: 96,
            }}
          >
            <svg width="54" height="54" viewBox="0 0 64 64" fill="none">
              <path d="M20 9h18l12 12v34H20V9Z" fill="white" opacity="0.96" />
              <path d="M38 9v12h12L38 9Z" fill="#BBD4EE" />
              <path d="M27 29h18M27 37h12M27 45h17" stroke="#2563EB" strokeWidth="4" strokeLinecap="round" />
              <path
                d="M14 44c7 0 8-19 15-19s8 19 15 19 8-19 15-19"
                stroke="#22D3EE"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                fontSize: 62,
                fontWeight: 800,
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}
            >
              Document Intelligence
            </div>
            <div
              style={{
                color: "#7DD3FC",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              Signals, risks and answers from your documents
            </div>
          </div>

          <div
            style={{
              color: "#B8C7D9",
              fontSize: 28,
              lineHeight: 1.35,
              maxWidth: 820,
            }}
          >
            Upload PDFs or text, generate structured reviews, and continue a grounded document chat.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
