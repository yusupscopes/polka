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
