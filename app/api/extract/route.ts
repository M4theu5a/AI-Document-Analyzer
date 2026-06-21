import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 8 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload a PDF or text file." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File is too large. Please upload a document under 8 MB." },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();

    if (file.type === "application/pdf" || fileName.endsWith(".pdf")) {
      const pdfParse = (await import("pdf-parse")).default;
      const parsed = await pdfParse(buffer);

      return NextResponse.json({
        fileName: file.name,
        text: parsed.text.trim(),
        pages: parsed.numpages,
      });
    }

    if (
      file.type.startsWith("text/") ||
      fileName.endsWith(".txt") ||
      fileName.endsWith(".md")
    ) {
      return NextResponse.json({
        fileName: file.name,
        text: buffer.toString("utf-8").trim(),
      });
    }

    return NextResponse.json(
      { error: "Unsupported file type. Use PDF, TXT, or Markdown." },
      { status: 415 },
    );
  } catch (error) {
    console.error("Document extraction failed", error);

    return NextResponse.json(
      { error: "We could not read that document. Try another file or paste text." },
      { status: 500 },
    );
  }
}
