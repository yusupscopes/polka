// Clerk Billing features. The Pro plan has both and the free plan has neither,
// so they're checked with `has({ feature })` rather than by plan.
export const BOTS = "bots"
export const SANDBOXES = "sandboxes"

// An action failed because the plan doesn't include a feature. The client
// shows the error with a link to /pricing.
export type UpgradeError = { error: string; upgrade: true }

export function upgradeError(error: string): UpgradeError {
  return { error, upgrade: true }
}

// An action failed because the subscription period's allowance is used up.
// The client shows the error with a link to /usage.
export type UsageError = { error: string; usage: true }

export function usageError(error: string): UsageError {
  return { error, usage: true }
}

// What a plan with both features may use in one monthly subscription period.
// Annual plans get twelve times as much for their year.
export const MONTHLY_ALLOWANCE = {
  // What the model may cost us, in billionths of a dollar: $5.
  aiNanos: 5_000_000_000,
  // Seconds the user's sandboxes may run in total: 30 hours.
  sandboxSeconds: 30 * 60 * 60,
}

// OpenAI's standard prices for the chat model, in billionths of a dollar per
// token (dollars per million tokens times 1,000). From
// https://developers.openai.com/api/docs/pricing, November 2026.
export const MODEL = "gpt-6-luna"
export const MODEL_PRICE = {
  inputNanos: 100, // $0.10 per 1M
  cachedInputNanos: 10, // $0.01 per 1M
  outputNanos: 500, // $0.50 per 1M
}

// Daytona's prices for a running sandbox of the default size (1 vCPU, 1 GiB),
// in billionths of a dollar per second: $0.0504 per vCPU-hour plus $0.0162
// per GiB-hour. Disk is free up to 5 GiB. https://www.daytona.io/pricing
export const SANDBOX_PRICE_NANOS_PER_SECOND = Math.round(
  ((0.0504 + 0.0162) / 3600) * 1e9
)

// Daytona stops a sandbox this long after its last activity, and bills it
// until then. Set on every sandbox, and 15 is Daytona's default too.
export const SANDBOX_AUTO_STOP_MINUTES = 15
