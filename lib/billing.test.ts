import type { LanguageModelUsage } from "ai"
import { describe, expect, it } from "vitest"

import {
  aiCostNanos,
  MODEL_PRICE,
  SANDBOX_PRICE_NANOS_PER_SECOND,
} from "@/lib/billing"

function usage({
  input,
  cached,
  output,
}: {
  input?: number
  cached?: number
  output?: number
}): LanguageModelUsage {
  return {
    inputTokens: input,
    inputTokenDetails: {
      noCacheTokens: undefined,
      cacheReadTokens: cached,
      cacheWriteTokens: undefined,
    },
    outputTokens: output,
    outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
    totalTokens: undefined,
  }
}

describe("aiCostNanos", () => {
  it("prices uncached input, cached input and output at their own rates", () => {
    expect(aiCostNanos(usage({ input: 1000 }))).toBe(
      1000 * MODEL_PRICE.inputNanos
    )
    expect(aiCostNanos(usage({ output: 1000 }))).toBe(
      1000 * MODEL_PRICE.outputNanos
    )
    expect(aiCostNanos(usage({ input: 1000, cached: 1000 }))).toBe(
      1000 * MODEL_PRICE.cachedInputNanos
    )
  })

  it("counts cached tokens once, out of the input total", () => {
    // 1,000 input tokens of which 400 were cached, plus 200 output tokens.
    expect(aiCostNanos(usage({ input: 1000, cached: 400, output: 200 }))).toBe(
      600 * MODEL_PRICE.inputNanos +
        400 * MODEL_PRICE.cachedInputNanos +
        200 * MODEL_PRICE.outputNanos
    )
  })

  it("treats missing token counts as zero", () => {
    expect(aiCostNanos(usage({}))).toBe(0)
    expect(aiCostNanos(usage({ input: 1000 }))).toBe(
      aiCostNanos(usage({ input: 1000, cached: undefined, output: undefined }))
    )
  })

  it("matches the published price: 1M input and 1M output tokens cost $0.60", () => {
    const nanos = aiCostNanos(usage({ input: 1_000_000, output: 1_000_000 }))
    expect(nanos / 1e9).toBeCloseTo(0.6)
  })
})

describe("SANDBOX_PRICE_NANOS_PER_SECOND", () => {
  it("is $0.0666 per hour for 1 vCPU and 1 GiB", () => {
    expect(SANDBOX_PRICE_NANOS_PER_SECOND).toBe(18_500)
    expect((SANDBOX_PRICE_NANOS_PER_SECOND * 3600) / 1e9).toBeCloseTo(0.0666)
  })
})
