import { prisma } from "@/lib/prisma";

// Wire-format shared between the API routes and the client. Mirrors the
// ChatSession shape used in the UI (timestamps as ISO strings).
export type DocumentPartDTO = { fileName: string; text: string };

export type ChatMessageDTO = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type ChatSessionDTO = {
  id: string;
  title: string;
  documentName: string;
  documentText: string;
  documents: DocumentPartDTO[];
  analysis: string;
  messages: ChatMessageDTO[];
  createdAt: string;
  updatedAt: string;
};

export async function listChats(userId: string): Promise<ChatSessionDTO[]> {
  const chats = await prisma.chat.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      documents: { orderBy: { position: "asc" } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  return chats.map((chat) => ({
    id: chat.id,
    title: chat.title,
    documentName: chat.documentName,
    documentText: chat.documentText,
    analysis: chat.analysis,
    documents: chat.documents.map((d) => ({ fileName: d.fileName, text: d.text })),
    messages: chat.messages.map((m) => ({
      id: m.id,
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
  }));
}

// Upsert a chat and fully replace its documents and messages. The children sets
// are small per chat, so replace-on-save keeps the sync logic simple and
// idempotent against the client's local state.
export async function upsertChat(
  userId: string,
  dto: ChatSessionDTO,
  options: { forceDocumentUpdate?: boolean } = {},
) {
  const createdAt = parseDate(dto.createdAt);
  const updatedAt = parseDate(dto.updatedAt);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.chat.findUnique({
      where: { id: dto.id },
      select: {
        userId: true,
        updatedAt: true,
        documents: { select: { id: true } },
      },
    });

    const effectiveUpdatedAt =
      existing && existing.updatedAt.getTime() > updatedAt.getTime()
        ? new Date(Math.max(Date.now(), existing.updatedAt.getTime()))
        : updatedAt;

    if (existing) {
      if (existing.userId !== userId) return false;
      const stalePayload = existing.updatedAt.getTime() > updatedAt.getTime();
      const appendsDocuments = dto.documents.length > existing.documents.length;
      if (stalePayload && !(options.forceDocumentUpdate && appendsDocuments)) {
        return false;
      }

      await tx.chat.update({
        where: { id: dto.id },
        data: {
          title: dto.title,
          documentName: dto.documentName,
          documentText: dto.documentText,
          analysis: dto.analysis,
          updatedAt: effectiveUpdatedAt,
        },
      });
    } else {
      await tx.chat.create({
        data: {
          id: dto.id,
          title: dto.title,
          documentName: dto.documentName,
          documentText: dto.documentText,
          analysis: dto.analysis,
          userId,
          createdAt,
          updatedAt: effectiveUpdatedAt,
        },
      });
    }

    await tx.document.deleteMany({ where: { chatId: dto.id } });
    if (dto.documents.length) {
      await tx.document.createMany({
        data: dto.documents.map((d, index) => ({
          chatId: dto.id,
          fileName: d.fileName,
          text: d.text,
          position: index,
        })),
      });
    }

    await tx.message.deleteMany({ where: { chatId: dto.id } });
    if (dto.messages.length) {
      await tx.message.createMany({
        data: dto.messages.map((m) => ({
          id: m.id,
          chatId: dto.id,
          role: m.role,
          content: m.content,
          createdAt: parseDate(m.createdAt),
        })),
      });
    }

    return true;
  });
}

export async function deleteChat(userId: string, id: string) {
  await prisma.chat.deleteMany({ where: { id, userId } });
}

// Minimal runtime validation for the untrusted request body.
export function parseChatSession(value: unknown): ChatSessionDTO | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Record<string, unknown>;
  if (typeof c.id !== "string" || !c.id) return null;
  if (!Array.isArray(c.documents) || !Array.isArray(c.messages)) return null;

  const now = new Date().toISOString();
  return {
    id: c.id,
    title: asString(c.title, "Untitled document"),
    documentName: asString(c.documentName, "No document loaded"),
    documentText: asString(c.documentText, ""),
    analysis: asString(c.analysis, ""),
    documents: c.documents.flatMap((d) => {
      if (!d || typeof d !== "object") return [];
      const part = d as Record<string, unknown>;
      return [{ fileName: asString(part.fileName, "document"), text: asString(part.text, "") }];
    }),
    messages: c.messages.flatMap((m) => {
      if (!m || typeof m !== "object") return [];
      const msg = m as Record<string, unknown>;
      if (typeof msg.id !== "string" || !msg.id) return [];
      return [
        {
          id: msg.id,
          role: msg.role === "assistant" ? "assistant" : "user",
          content: asString(msg.content, ""),
          createdAt: asString(msg.createdAt, now),
        } as ChatMessageDTO,
      ];
    }),
    createdAt: asString(c.createdAt, now),
    updatedAt: asString(c.updatedAt, now),
  };
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}
