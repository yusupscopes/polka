import "server-only"

import { Daytona } from "@daytona/sdk"

// Pass the config explicitly. Next.js loads .env.local into process.env, and
// the SDK refuses to guess whether DAYTONA_API_URL came from the shell or a
// dotenv file.
export const daytona = new Daytona({
  apiKey: process.env.DAYTONA_API_KEY,
  apiUrl: process.env.DAYTONA_API_URL,
})

// Created blank with every bot's sandbox. The bot writes what it learns about
// the person here, so it remembers across chats, including group chats.
export const MEMORY_PATH = "/home/daytona/MEMORY.md"
