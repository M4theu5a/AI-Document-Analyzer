import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "session";

function getSecret() {
  return new TextEncoder().encode(process.env.SESSION_SECRET ?? "");
}

async function isAuthenticated(token: string | undefined) {
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

// Soft auth: the app is browsable without login. Access is only required when
// using features (via the client-side modal) and on the API routes (401). Here
// we just keep an already-logged-in user away from the /login screen.
export async function middleware(request: NextRequest) {
  const authed = await isAuthenticated(request.cookies.get(SESSION_COOKIE)?.value);
  if (authed) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/login"],
};
