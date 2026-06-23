import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getTokenStatus } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const status = await getTokenStatus(user.id);
  return NextResponse.json({ status });
}
