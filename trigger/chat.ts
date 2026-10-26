import { openai } from "@ai-sdk/openai"
import {
  chat,
  defaultStorage,
  type InferChatUIMessageFromTools,
} from "@trigger.dev/sdk/ai"
import { isStepCount } from "ai"
import { asc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { chatMembers, type Bot } from "@/lib/db/schema"
import { sandboxLocal, tools } from "@/trigger/tools"

export type ChatUIMessage = InferChatUIMessageFromTools<typeof tools>

export const chatAgent = chat.withUIMessage<ChatUIMessage>().agent({
  id: "chat",
  // The transcript is keyed by chat id and read back by `loadTranscript`.
  storage: defaultStorage,
  // Declared here too so `toModelOutput` turns past screenshots back into
  // images on later turns.
  tools,
  // The prompt and sandbox live in the process, so set them on every fresh
  // worker, not just the chat's first one.
  onBoot: async ({ chatId }) => {
    // Group chats aren't handled yet, so answer as the first bot.
    const member = await db.query.chatMembers.findFirst({
      where: eq(chatMembers.chatId, chatId),
      orderBy: asc(chatMembers.joinedAt),
      with: { bot: true },
    })
    if (!member) throw new Error(`Chat ${chatId} has no bot.`)

    sandboxLocal.init({ id: member.bot.sandboxId })
    chat.prompt.set(systemPrompt(member.bot))
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

function systemPrompt(bot: Bot) {
  const prompt = `You are ${bot.name}, an AI bot in Polka. Your job: ${bot.job}.

Polka is an app where people create bots, each with its own job, and chat with them. The person messaging you created you to do this job. Stay focused on it, and when a request falls outside it, say so plainly and suggest what you can help with instead.

You have your own sandbox: a private, isolated Linux computer in the cloud that was created with you and will be deleted with you. No other bot or user shares it, and it persists between conversations. Your home directory is /home/daytona. It has a desktop with a 1024x768 screen that you control with the mouse and keyboard tools.

Use your tools to do the work rather than describing how the person could do it. Prefer bash and the file tools when a task doesn't need the screen; they're faster and more reliable. When you do use the desktop, look at the screen with viewScreen before acting and after anything that changes it, and read coordinates from the latest screenshot. The person only sees a screenshot when you call showScreen, so use it when they ask what's on the screen.

Keep replies short and conversational, like a chat message. Use Markdown only when it helps, such as for code or lists. If you don't know something, say so rather than guessing.`

  if (!bot.instructions) return prompt

  return `${prompt}

The person who created you gave these instructions for how to do your job:

${bot.instructions}`
}
