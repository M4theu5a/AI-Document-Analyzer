import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_FILES = 5;

type ExtractedDocument = {
  fileName: string;
  text: string;
  pages?: number;
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploadedFiles = [
      ...formData.getAll("files"),
      ...formData.getAll("file"),
    ].filter((entry): entry is File => entry instanceof File);

    if (!uploadedFiles.length) {
      return NextResponse.json({ error: "Upload at least one PDF or text file." }, { status: 400 });
    }

    if (uploadedFiles.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Upload up to ${MAX_FILES} documents at a time.` },
        { status: 413 },
      );
    }

    const oversizedFile = uploadedFiles.find((file) => file.size > MAX_FILE_SIZE);

    if (oversizedFile) {
      return NextResponse.json(
        { error: `${oversizedFile.name} is too large. Each document must be under 8 MB.` },
        { status: 413 },
      );
    }

    const unsupportedFile = uploadedFiles.find((file) => !isSupportedFile(file));

    if (unsupportedFile) {
      return NextResponse.json(
        { error: `${unsupportedFile.name} is not supported. Use PDF, TXT, or Markdown.` },
        { status: 415 },
      );
    }

    const documents = await Promise.all(uploadedFiles.map(extractDocumentText));
    const readableDocuments = documents.filter((document) => document.text.trim());

    if (!readableDocuments.length) {
      return NextResponse.json(
        { error: "We could not extract readable text from those documents." },
        { status: 422 },
      );
    }

    return NextResponse.json({
      fileName: buildDocumentSetName(readableDocuments),
      text: combineDocumentTexts(readableDocuments),
      documents: readableDocuments,
    });
  } catch (error) {
    console.error("Document extraction failed", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "We could not read that document. Try another file or paste text." },
      { status: 500 },
    );
  }
}

async function extractDocumentText(file: File): Promise<ExtractedDocument> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file.name.toLowerCase();

  if (file.type === "application/pdf" || fileName.endsWith(".pdf")) {
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(buffer);

    return {
      fileName: file.name,
      text: parsed.text.trim(),
      pages: parsed.numpages,
    };
  }

  if (
    file.type.startsWith("text/") ||
    fileName.endsWith(".txt") ||
    fileName.endsWith(".md")
  ) {
    return {
      fileName: file.name,
      text: buffer.toString("utf-8").trim(),
    };
  }

  throw new Error(`${file.name} is not supported. Use PDF, TXT, or Markdown.`);
}

function isSupportedFile(file: File) {
  const fileName = file.name.toLowerCase();

  return (
    file.type === "application/pdf" ||
    fileName.endsWith(".pdf") ||
    file.type.startsWith("text/") ||
    fileName.endsWith(".txt") ||
    fileName.endsWith(".md")
  );
}

function buildDocumentSetName(documents: ExtractedDocument[]) {
  if (documents.length === 1) {
    return documents[0].fileName;
  }

  const visibleNames = documents.slice(0, 2).map((document) => document.fileName).join(", ");
  const remainingCount = documents.length - 2;

  return remainingCount > 0
    ? `${documents.length} documents: ${visibleNames} +${remainingCount}`
    : `${documents.length} documents: ${visibleNames}`;
}

function combineDocumentTexts(documents: ExtractedDocument[]) {
  return documents
    .map(
      (document, index) =>
        `Document ${index + 1}: ${document.fileName}\n\n${document.text}`,
    )
    .join("\n\n---\n\n");
}
