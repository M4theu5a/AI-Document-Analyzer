import { NextResponse } from "next/server";
import { listChats } from "@/lib/chats";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const chats = await listChats(user.id);
    return NextResponse.json({ chats });
  } catch (error) {
    console.error("Failed to list chats", error);
    return NextResponse.json({ error: "Could not load chats." }, { status: 500 });
  }
}
