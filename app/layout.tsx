import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocAnalyzer AI - Document Intelligence",
  description:
    "Intelligent document analysis with AI-powered summaries, key points, and Q&A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="dark-theme">
        {children}
      </body>
    </html>
  );
}
