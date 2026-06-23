import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startSession, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Enter email and password." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    // Same response for unknown user or wrong password (avoids enumeration).
    if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    await startSession(user.id);
    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    console.error("login failed", error);
    return NextResponse.json({ error: "Could not sign in." }, { status: 500 });
  }
}
