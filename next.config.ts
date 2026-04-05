import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: ["100.103.227.36", "127.0.0.1", "localhost", "0.0.0.0"],
  }),
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,           // suppress build output noise
  sourcemaps: {
    filesToDeleteAfterUpload: ['.next/static/**/*.map'], // don't expose source maps to client
  },
  disableLogger: true,
  automaticVercelMonitors: false,
});
