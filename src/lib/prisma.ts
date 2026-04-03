import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";

// Required for @neondatabase/serverless in Node.js environments
// (no-op in edge/serverless — already uses fetch)
if (typeof WebSocket === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  neonConfig.webSocketConstructor = require("ws");
}

// NeonDB fetch-based pooling timeout (applies to all requests)
neonConfig.fetchConnectionCache = true;

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }

  // PrismaNeon uses NeonDB's HTTP-based pooling (neon serverless driver).
  // Connection pooling is handled at the Neon proxy level, not in-app.
  // Ensure DATABASE_URL uses the pooled endpoint (-pooler.*.neon.tech).
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

// Global singleton — prevents exhausting DB connections in dev (HMR)
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
