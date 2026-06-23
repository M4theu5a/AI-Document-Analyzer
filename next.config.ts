import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@prisma/client", "@prisma/adapter-pg", "pg"],
};

export default nextConfig;
