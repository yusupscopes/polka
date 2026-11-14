import * as Sentry from "@sentry/node"
import { tasks } from "@trigger.dev/sdk"

// Trigger.dev loads this file before any task runs. Tasks report to the same
// Sentry project as the Next.js app.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Trigger.dev already instruments runs with OpenTelemetry. Sentry's default
  // integrations would install a second OTel setup, so only errors and logs go
  // to Sentry.
  defaultIntegrations: false,
})

// Sentry.logger batches logs. A waiting run may be checkpointed and its
// process frozen, and a finished one may exit, so send buffered logs first.
tasks.onWait(async () => {
  await Sentry.flush(2000)
})
tasks.onComplete(async () => {
  await Sentry.flush(2000)
})

// Fires once a run has failed for good (after its last retry).
tasks.onFailure(async ({ error, ctx }) => {
  Sentry.captureException(error, (scope) => {
    scope.setTags({
      "trigger.task": ctx.task.id,
      "trigger.run": ctx.run.id,
      "trigger.attempt": ctx.attempt.number,
    })
    scope.setContext("trigger", {
      task: ctx.task.id,
      run: ctx.run.id,
      attempt: ctx.attempt.number,
      environment: ctx.environment.slug,
      version: ctx.deployment?.version,
    })
    // Separate dev runs from deployed ones, matching the run's Trigger.dev
    // environment rather than NODE_ENV.
    scope.addEventProcessor((event) => ({
      ...event,
      environment: ctx.environment.type.toLowerCase(),
    }))
    return scope
  })
  // The worker can exit right after this hook, so send the event now.
  await Sentry.flush(2000)
})
