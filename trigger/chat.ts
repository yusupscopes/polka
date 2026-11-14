import { openai } from "@ai-sdk/openai"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"
import {
  isStepCount,
  type InferUITools,
  type UIDataTypes,
  type UIMessage,
} from "ai"
import { asc, eq } from "drizzle-orm"
import { z } from "zod"

import { MODEL } from "@/lib/billing"
import { MEMORY_PATH } from "@/lib/daytona"
import { db } from "@/lib/db"
import { chatMembers, chats, type Bot, type Chat } from "@/lib/db/schema"
import {
  aiCostNanos,
  aiLimitMessage,
  getUsageStatus,
  recordAiUsage,
} from "@/lib/usage"
import { crewLocal, sandboxLocal, tools, usageLocal } from "@/trigger/tools"

// Replies carry the bot that wrote them, so group chats can show who said what.
// After a handoff, the rest of the reply is the new bot's.
export type ChatMetadata = { botId?: string }

export type ChatUIMessage = UIMessage<
  ChatMetadata,
  UIDataTypes,
  InferUITools<typeof tools>
>

type ToolName = keyof typeof tools

// Every tool except handoff, for direct chats and for the bot that was handed
// a message, so it can't pass it on again.
const withoutHandoff = (Object.keys(tools) as ToolName[]).filter(
  (name) => name !== "handoff"
)

export const chatAgent = chat.withUIMessage<ChatUIMessage>().agent({
  id: "chat",
  // The transcript is keyed by chat id and read back by `loadTranscript`.
  storage: defaultStorage,
  // Declared here too so `toModelOutput` turns past screenshots back into
  // images on later turns.
  tools,
  // The bot the person picked to answer. Direct chats leave it out.
  clientDataSchema: z.object({ botId: z.string().optional() }),
  // The prompt and sandbox live in the process and depend on which bot
  // answers, so set them at the start of every turn.
  onTurnStart: async ({ chatId, clientData }) => {
    const row = await db.query.chats.findFirst({
      where: eq(chats.id, chatId),
      with: {
        members: { orderBy: asc(chatMembers.joinedAt), with: { bot: true } },
      },
    })
    const bots = row?.members.map((member) => member.bot) ?? []
    // The id comes from the browser, so it must be one of this chat's bots.
    const bot = clientData?.botId
      ? bots.find((bot) => bot.id === clientData.botId)
      : bots[0]
    if (!row || !bot) throw new Error(`Chat ${chatId} has no such bot.`)

    // The app checks before sending too. This stops a client that doesn't,
    // and a plan that ended mid-chat. The message reaches the chat as is.
    const usage = await getUsageStatus(row.userId)
    if (!usage) throw new Error("Upgrade to Pro to chat with bots.")
    if (!usage.aiLeft) throw new Error(aiLimitMessage(usage.period))
    usageLocal.init({
      userId: row.userId,
      period: usage.period,
      aiNanos: usage.used.aiNanos,
    })

    crewLocal.init({ chat: row, bots, botId: bot.id })
    sandboxLocal.init({ id: bot.sandboxId })
    chat.prompt.set(systemPrompt(bot, row, bots))
    chat.setUIMessageStreamOptions({
      messageMetadata: ({ part }) =>
        part.type === "start" ? { botId: bot.id } : undefined,
    })
  },
  run: async ({ chatId, messages, tools, signal, streamText }) =>
    streamText({
      model: openai(MODEL),
      messages,
      tools,
      // Only group chats have another bot to hand off to.
      activeTools: crewLocal.chat.kind === "group" ? undefined : withoutHandoff,
      // A handoff hands the remaining steps to the new bot: its prompt, and
      // (through `sandboxLocal`) its sandbox.
      prepareStep: () => {
        const { handoff, bots, botId } = crewLocal
        if (!handoff) return undefined
        const bot = bots.find((bot) => bot.id === botId)
        if (!bot) return undefined
        return {
          instructions: systemPrompt(bot, crewLocal.chat, bots, handoff),
          activeTools: withoutHandoff,
        }
      },
      // Every step goes in the ledger as it finishes, so a stopped or failed
      // turn still counts what it used.
      onStepFinish: async ({ usage }) => {
        await recordAiUsage({
          userId: usageLocal.userId,
          botId: crewLocal.botId,
          chatId,
          usage,
        })
      },
      stopWhen: [
        // Computer use takes many small steps: look, click, look again.
        isStepCount(50),
        // Running out of allowance ends the turn after the current step.
        ({ steps }) =>
          steps.reduce(
            (spent, step) => spent + aiCostNanos(step.usage),
            usageLocal.aiNanos
          ) >= usageLocal.period.allowance.aiNanos,
      ],
      abortSignal: signal,
    }),
})

function systemPrompt(
  bot: Bot,
  chat: Chat,
  members: Bot[],
  handoff?: { fromBotId: string; reason: string }
) {
  const group = chat.kind === "group"

  let prompt = `You are ${bot.name}, an AI bot in Polka. Your job: ${bot.job}.

Polka is an app where people create bots, each with its own job, and chat with them. The person messaging you created you to do this job. Stay focused on it, and when a request falls outside it, say so plainly${group ? ", or hand it to a bot whose job fits," : ""} and suggest what you can help with instead.

You have your own sandbox: a private, isolated Linux computer in the cloud that was created with you and will be deleted with you. No other bot or user shares it, and it persists between conversations. Your home directory is /home/daytona. It has a desktop with a 1024x768 screen that you control with the mouse and keyboard tools.

Use your tools to do the work rather than describing how the person could do it. Prefer bash and the file tools when a task doesn't need the screen; they're faster and more reliable. When you do use the desktop, look at the screen with viewScreen before acting and after anything that changes it, and read coordinates from the latest screenshot. The person only sees a screenshot when you call showScreen, so use it when they ask what's on the screen.

Keep replies short and conversational, like a chat message. Use Markdown only when it helps, such as for code or lists. If you don't know something, say so rather than guessing.

${memoryPrompt(group)}`

  if (group) prompt += `\n\n${groupPrompt(bot, chat, members, handoff)}`

  if (!bot.instructions) return prompt

  return `${prompt}

The person who created you gave these instructions for how to do your job:

${bot.instructions}`
}

// Each chat only sees its own messages. The memory file is how a bot carries
// what it learned in its direct chat into group chats, and back.
function memoryPrompt(group: boolean) {
  return `## Your memory

You only see the messages of the chat you're in. You also have your own direct chat with the person, and you may be in group chats with them, but you can't see those conversations from here. Your memory file, ${MEMORY_PATH}, is how you remember things across all of them. It's a Markdown file that starts out empty, and only you can read or change it.

Read it with readFile when the answer might depend on something from another conversation: when the person refers to something they told you before, asks what you remember or know about them, or asks about earlier work${group ? ". This is a group chat, so the person's direct chat with you isn't here; check your memory before saying you don't know something they may have told you there" : ""}. Read it before saying you don't know or don't remember something about the person.

Update it whenever you learn something worth remembering next time, in any chat: facts the person shares about themselves, their preferences, decisions, ongoing tasks and their state, and where you saved important files. Also update it when the person asks you to remember something, and remove things when they ask you to forget them or they stop being true. Read the file first, then write it back whole with writeFile, keeping it short and organized under headings, one fact per line. Don't save small talk, secrets such as passwords or keys, or things you can easily find again. Do it quietly alongside your reply; mention it only when the person asked you to remember something.`
}

function groupPrompt(
  bot: Bot,
  chat: Chat,
  members: Bot[],
  handoff?: { fromBotId: string; reason: string }
) {
  const others = members.filter((member) => member.id !== bot.id)
  const roster = others
    .map((member) => `- ${member.name} (id: ${member.id}): ${member.job}`)
    .join("\n")

  const prompt = `## This is a group chat

You're in a group chat called "${chat.name}" with one person and these other bots:

${roster}

How the group chat works:
- The person picks which bot answers each message. Only that bot replies; the others stay quiet until they're picked.
- The conversation includes everyone's messages. Earlier replies may be from the other bots, not you, so don't take credit for their work or repeat what they already said. Build on it instead.
- Each bot has its own sandbox. You can't see the other bots' files, desktop or command output, only what they said in the chat. If you need something they made, ask the person to have that bot share it in the chat.
- Speak as yourself and refer to the other bots by name.`

  if (handoff) {
    const from =
      members.find((member) => member.id === handoff.fromBotId)?.name ??
      "Another bot"
    return `${prompt}

## You were handed this message

The person sent their latest message to ${from}, who handed it to you: "${handoff.reason}". The handoff just above is ${from}'s, not yours. Answer the person's latest message yourself now, using your own tools and sandbox. You can't hand it off again; if it doesn't fit your job either, say so and suggest which bot the person should pick.`
  }

  return `${prompt}

## Handing off

You have a handoff tool. When the person's message is clearly a better fit for another bot's job than yours, call handoff with that bot's id and a one-line reason instead of answering. That bot then answers in the same reply.
- Hand off only when another bot's job clearly fits better. If the message is within your job, or none of the other bots fits better, answer it yourself.
- Hand off before you start the work. Don't do part of it and then hand off.
- Call handoff on its own, with no reply text and no other tools alongside it.
- If the person asks for you specifically, answer yourself even if another bot might do it better. You can mention that the other bot could help.`
}
