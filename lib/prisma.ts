import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Prisma 7 requires a driver adapter for the runtime connection (the datasource
// `url` lives in prisma.config.ts and is only used by the CLI/Migrate).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const globalForPrisma = globalThis as unknown as {
  prisma?: InstanceType<typeof PrismaClient>;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

// Avoid exhausting connections during Next.js dev hot-reload.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
