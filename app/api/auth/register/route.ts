import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, startSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!name) return bad("Enter your name.");
    if (!isEmail(email)) return bad("Invalid email.");
    if (password.length < 8) return bad("Password must be at least 8 characters.");

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const tokenQuota = Number(process.env.TOKEN_MONTHLY_QUOTA) || 100000;
    const user = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password), tokenQuota },
      select: { id: true, email: true, name: true },
    });
    await startSession(user.id);
    return NextResponse.json({ user });
  } catch (error) {
    console.error("register failed", error);
    return NextResponse.json({ error: "Could not create the account." }, { status: 500 });
  }
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
