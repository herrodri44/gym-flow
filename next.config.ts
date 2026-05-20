import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  silent: true,
  // Source maps uploaded to Sentry but not shipped to the browser
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  // Tree-shake Sentry code not used at runtime
  widenClientFileUpload: false,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
