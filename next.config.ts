import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The Daytona SDK loads optional modules such as `form-data` lazily with
  // `require`, which fails once Next bundles it ("dynamic usage of require is
  // not supported"). Let Node load it instead.
  serverExternalPackages: ["@daytona/sdk"],
  experimental: {
    agentUpgrade: "security",
  },
}

export default nextConfig
