import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs/config"

const nextConfig: NextConfig = {
  // The Daytona SDK loads optional modules such as `form-data` lazily with
  // `require`, which fails once Next bundles it ("dynamic usage of require is
  // not supported"). Let Node load it instead.
  serverExternalPackages: ["@daytona/sdk"],
  experimental: {
    agentUpgrade: "security",
  },
}

export default withSentryConfig(nextConfig, {
  org: "personal-projects-sp",
  project: "polka",

  // Uploads source maps on production builds. Without it the build still
  // succeeds, but stack traces stay minified.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload more client files for readable client stack traces.
  widenClientFileUpload: true,

  // Send browser events through the app so ad blockers don't drop them.
  tunnelRoute: "/monitoring",

  silent: !process.env.CI,
})
