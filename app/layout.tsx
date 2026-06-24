import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hanken",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "Document Intelligence Workspace",
  description:
    "A document intelligence workspace for summaries, key points and risk signals.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://docsignal.vercel.app"),
  openGraph: {
    title: "Document Intelligence Workspace",
    description:
      "Upload documents, extract key signals, review risks and continue the conversation.",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Document Intelligence Workspace preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Document Intelligence Workspace",
    description:
      "Upload documents, extract key signals, review risks and continue the conversation.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${hanken.variable} ${jetbrains.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
