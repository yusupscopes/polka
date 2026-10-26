import { openai } from "@ai-sdk/openai"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"

export const chatAgent = chat.agent({
  id: "chat",
  // The transcript is keyed by chat id and read back by `loadTranscript`.
  storage: defaultStorage,
  run: async ({ messages, signal, streamText }) =>
    streamText({
      model: openai("gpt-6-luna"),
      messages,
      abortSignal: signal,
    }),
})
