import { openai } from "@ai-sdk/openai"
import {
  chat,
  defaultStorage,
  type InferChatUIMessageFromTools,
} from "@trigger.dev/sdk/ai"
import { isStepCount } from "ai"
import { asc, eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/lib/db"
import { chatMembers, chats, type Bot, type Chat } from "@/lib/db/schema"
import { sandboxLocal, tools } from "@/trigger/tools"

export type ChatUIMessage = InferChatUIMessageFromTools<typeof tools>

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

    sandboxLocal.init({ id: bot.sandboxId })
    chat.prompt.set(systemPrompt(bot, row, bots))
  },
  run: async ({ messages, tools, signal, streamText }) =>
    streamText({
      model: openai("gpt-6-luna"),
      messages,
      tools,
      // Computer use takes many small steps: look, click, look again.
      stopWhen: isStepCount(50),
      abortSignal: signal,
    }),
})

function systemPrompt(bot: Bot, chat: Chat, members: Bot[]) {
  let prompt = `You are ${bot.name}, an AI bot in Polka. Your job: ${bot.job}.

Polka is an app where people create bots, each with its own job, and chat with them. The person messaging you created you to do this job. Stay focused on it, and when a request falls outside it, say so plainly and suggest what you can help with instead.

You have your own sandbox: a private, isolated Linux computer in the cloud that was created with you and will be deleted with you. No other bot or user shares it, and it persists between conversations. Your home directory is /home/daytona. It has a desktop with a 1024x768 screen that you control with the mouse and keyboard tools.

Use your tools to do the work rather than describing how the person could do it. Prefer bash and the file tools when a task doesn't need the screen; they're faster and more reliable. When you do use the desktop, look at the screen with viewScreen before acting and after anything that changes it, and read coordinates from the latest screenshot. The person only sees a screenshot when you call showScreen, so use it when they ask what's on the screen.

Keep replies short and conversational, like a chat message. Use Markdown only when it helps, such as for code or lists. If you don't know something, say so rather than guessing.`

  // Without this, a bot reads the other bots' replies as its own.
  if (chat.kind === "group") {
    const others = members
      .filter((member) => member.id !== bot.id)
      .map((member) => member.name)
      .join(", ")
    prompt += `

This is a group chat called "${chat.name}" with other bots: ${others}. The person picks which bot answers each message, and they picked you for this one. Earlier replies in the conversation may be from the other bots, not you.`
  }

  if (!bot.instructions) return prompt

  return `${prompt}

The person who created you gave these instructions for how to do your job:

${bot.instructions}`
}
