import "server-only";
import { prisma } from "@/lib/prisma";

export type TokenStatus = {
  quota: number;
  used: number;
  remaining: number;
  period: string;
};

// Current period as "YYYY-MM" (basis for the monthly quota reset).
export function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Reads the quota status and, if the month rolled over, resets usage (lazy reset).
export async function getTokenStatus(userId: string): Promise<TokenStatus | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tokenQuota: true, tokensUsed: true, quotaPeriod: true },
  });
  if (!user) return null;

  const period = currentPeriod();
  let used = user.tokensUsed;
  if (user.quotaPeriod !== period) {
    used = 0;
    await prisma.user.update({
      where: { id: userId },
      data: { tokensUsed: 0, quotaPeriod: period },
    });
  }

  return {
    quota: user.tokenQuota,
    used,
    remaining: Math.max(0, user.tokenQuota - used),
    period,
  };
}

// Adds usage to the current period (resetting if the month rolled over).
export async function recordUsage(userId: string, tokens: number) {
  if (tokens <= 0) return;
  const period = currentPeriod();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { quotaPeriod: true },
  });
  if (!user) return;

  if (user.quotaPeriod !== period) {
    await prisma.user.update({
      where: { id: userId },
      data: { tokensUsed: tokens, quotaPeriod: period },
    });
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: { tokensUsed: { increment: tokens } },
    });
  }
}
