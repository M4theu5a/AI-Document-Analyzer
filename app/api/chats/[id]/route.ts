import { NextResponse } from "next/server";
import { deleteChat, parseChatSession, upsertChat } from "@/lib/chats";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const dto = parseChatSession(await request.json());
    if (!dto || dto.id !== id) {
      return NextResponse.json({ error: "Invalid chat payload." }, { status: 400 });
    }
    const saved = await upsertChat(user.id, dto);
    if (!saved) {
      return NextResponse.json({ ok: false, stale: true }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to save chat", error);
    return NextResponse.json({ error: "Could not save chat." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    await deleteChat(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete chat", error);
    return NextResponse.json({ error: "Could not delete chat." }, { status: 500 });
  }
}
