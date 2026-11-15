import { describe, expect, it } from "vitest"

import { insertBotSchema, insertGroupChatSchema } from "@/lib/db/schema"

const validBot = {
  name: "Ada",
  avatar: "seed-123",
  job: "Researches papers",
  instructions: "",
}

function firstMessage(result: { error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message
}

describe("insertBotSchema", () => {
  it("accepts a valid bot and trims name and job", () => {
    const result = insertBotSchema.safeParse({
      ...validBot,
      name: "  Ada  ",
      job: "  Researches papers  ",
    })
    expect(result.success).toBe(true)
    expect(result.data?.name).toBe("Ada")
    expect(result.data?.job).toBe("Researches papers")
  })

  it.each(["", "   "])("rejects the name %j", (name) => {
    const result = insertBotSchema.safeParse({ ...validBot, name })
    expect(result.success).toBe(false)
    expect(firstMessage(result)).toBe("Give your bot a name.")
  })

  it("rejects a name over 50 characters", () => {
    expect(
      insertBotSchema.safeParse({ ...validBot, name: "a".repeat(50) }).success
    ).toBe(true)
    expect(
      insertBotSchema.safeParse({ ...validBot, name: "a".repeat(51) }).success
    ).toBe(false)
  })

  it("rejects a blank job", () => {
    const result = insertBotSchema.safeParse({ ...validBot, job: "   " })
    expect(result.success).toBe(false)
    expect(firstMessage(result)).toBe("Say what your bot is for.")
  })

  it("rejects a job over 80 characters", () => {
    expect(
      insertBotSchema.safeParse({ ...validBot, job: "a".repeat(80) }).success
    ).toBe(true)
    expect(
      insertBotSchema.safeParse({ ...validBot, job: "a".repeat(81) }).success
    ).toBe(false)
  })

  it("accepts empty instructions and rejects more than 2000 characters", () => {
    expect(
      insertBotSchema.safeParse({ ...validBot, instructions: "" }).success
    ).toBe(true)
    expect(
      insertBotSchema.safeParse({ ...validBot, instructions: "a".repeat(2000) })
        .success
    ).toBe(true)
    expect(
      insertBotSchema.safeParse({ ...validBot, instructions: "a".repeat(2001) })
        .success
    ).toBe(false)
  })

  it("drops server-owned fields", () => {
    const result = insertBotSchema.safeParse({
      ...validBot,
      id: "bot-1",
      userId: "user_attacker",
      sandboxId: "sandbox-1",
    })
    expect(result.success).toBe(true)
    expect(result.data).toEqual(validBot)
  })
})

describe("insertGroupChatSchema", () => {
  const validGroup = { name: "Research crew", botIds: ["a", "b"] }

  it("accepts a valid group and trims the name", () => {
    const result = insertGroupChatSchema.safeParse({
      ...validGroup,
      name: "  Crew  ",
    })
    expect(result.success).toBe(true)
    expect(result.data?.name).toBe("Crew")
  })

  it("rejects a blank name", () => {
    const result = insertGroupChatSchema.safeParse({
      ...validGroup,
      name: "   ",
    })
    expect(result.success).toBe(false)
    expect(firstMessage(result)).toBe("Give your group a name.")
  })

  it.each([[[]], [["a"]]])("rejects botIds %j", (botIds) => {
    const result = insertGroupChatSchema.safeParse({ ...validGroup, botIds })
    expect(result.success).toBe(false)
    expect(firstMessage(result)).toBe("Pick at least two bots.")
  })

  it("drops server-owned fields", () => {
    const result = insertGroupChatSchema.safeParse({
      ...validGroup,
      userId: "user_attacker",
      kind: "direct",
    })
    expect(result.data).toEqual(validGroup)
  })
})
