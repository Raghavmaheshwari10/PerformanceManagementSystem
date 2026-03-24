import { defineConfig } from "prisma/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";

// ws needed for Node.js CLI environment (not edge)
// eslint-disable-next-line @typescript-eslint/no-require-imports
neonConfig.webSocketConstructor = require("ws");

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL!,
  },
  // @ts-expect-error -- migrate.adapter() is a valid Prisma 7 runtime API but not yet reflected in @prisma/config 7.4.2 types
  migrate: {
    async adapter() {
      return new PrismaNeon({ connectionString: process.env.DIRECT_URL! });
    },
  },
});
