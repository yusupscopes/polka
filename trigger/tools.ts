import { chat } from "@trigger.dev/sdk/ai"
import { tool, type ToolSet } from "ai"
import { z } from "zod"

import { daytona } from "@/lib/daytona"

// The bot's sandbox, set in `onBoot` so every tool call reaches the same one.
export const sandboxLocal = chat.local<{ id: string }>({ id: "sandbox" })

// Long output is cut so one command can't flood the model's context.
const MAX_OUTPUT = 20_000

// Look the sandbox up on every call instead of caching it. A chat can sit idle
// long enough for Daytona to auto-stop the sandbox, and a cached handle would
// go stale without saying so.
async function getSandbox() {
  const sandbox = await daytona.get(sandboxLocal.id)
  if (sandbox.state !== "started") await sandbox.start()
  return sandbox
}

// The desktop doesn't run until it's started, and it stops with the sandbox.
async function getDesktop() {
  const sandbox = await getSandbox()
  const { status } = await sandbox.computerUse.getStatus()
  if (status !== "active") await sandbox.computerUse.start()
  return sandbox.computerUse
}

async function screenshot() {
  const desktop = await getDesktop()
  const { screenshot } = await desktop.screenshot.takeCompressed({
    format: "jpeg",
    quality: 70,
    showCursor: true,
  })
  if (!screenshot) throw new Error("The screenshot came back empty.")
  return { image: screenshot, mediaType: "image/jpeg" }
}

// The model sees the screenshot as an image, not as a wall of base64.
function screenshotToModel({
  output,
}: {
  output: Awaited<ReturnType<typeof screenshot>>
}) {
  return {
    type: "content" as const,
    value: [
      {
        type: "file" as const,
        mediaType: output.mediaType,
        data: { type: "data" as const, data: output.image },
      },
    ],
  }
}

function truncate(text: string) {
  if (text.length <= MAX_OUTPUT) return text
  return `${text.slice(0, MAX_OUTPUT)}\n… (cut off, ${text.length - MAX_OUTPUT} more characters)`
}

const coordinates = {
  x: z.number().int().min(0).describe("Pixels from the left of the screen."),
  y: z.number().int().min(0).describe("Pixels from the top of the screen."),
}

export const tools = {
  bash: tool({
    description:
      "Run a bash command in your sandbox and get its exit code and output (stdout and stderr together). Each call is a fresh shell, so cd and exported variables don't carry over. Don't use it for programs that never exit, such as servers; start those in the background with nohup.",
    inputSchema: z.object({
      command: z.string().describe("The command to run."),
      cwd: z
        .string()
        .optional()
        .describe("Directory to run in. Defaults to your home directory."),
      timeout: z
        .number()
        .int()
        .min(1)
        .max(600)
        .default(60)
        .describe("Seconds to wait before the command is killed."),
    }),
    execute: async ({ command, cwd, timeout }) => {
      const sandbox = await getSandbox()
      const { exitCode, result } = await sandbox.process.executeCommand(
        command,
        cwd,
        undefined,
        timeout
      )
      return { exitCode, output: truncate(result) }
    },
  }),

  readFile: tool({
    description: "Read a text file in your sandbox.",
    inputSchema: z.object({
      path: z
        .string()
        .describe("Absolute path, or relative to your home directory."),
    }),
    execute: async ({ path }) => {
      const sandbox = await getSandbox()
      const content = await sandbox.fs.downloadFile(path)
      return { content: truncate(content.toString("utf8")) }
    },
  }),

  writeFile: tool({
    description:
      "Create or overwrite a text file in your sandbox. Missing parent directories are created.",
    inputSchema: z.object({
      path: z
        .string()
        .describe("Absolute path, or relative to your home directory."),
      content: z.string().describe("The full contents of the file."),
    }),
    execute: async ({ path, content }) => {
      const sandbox = await getSandbox()
      await sandbox.fs.uploadFile(Buffer.from(content, "utf8"), path)
      return { bytes: Buffer.byteLength(content, "utf8") }
    },
  }),

  listFiles: tool({
    description:
      "List the files and directories in a directory of your sandbox.",
    inputSchema: z.object({
      path: z
        .string()
        .default(".")
        .describe("Absolute path, or relative to your home directory."),
    }),
    execute: async ({ path }) => {
      const sandbox = await getSandbox()
      const files = await sandbox.fs.listFiles(path)
      return {
        entries: files.map((file) => ({
          name: file.name,
          isDir: file.isDir,
          size: file.size,
        })),
      }
    },
  }),

  mouseClick: tool({
    description: "Click the mouse at a point on the screen.",
    inputSchema: z.object({
      ...coordinates,
      button: z.enum(["left", "right", "middle"]).default("left"),
      double: z.boolean().default(false).describe("Double-click instead."),
    }),
    execute: async ({ x, y, button, double }) => {
      const desktop = await getDesktop()
      await desktop.mouse.click(x, y, button, double)
      return { x, y }
    },
  }),

  mouseMove: tool({
    description: "Move the mouse pointer to a point on the screen.",
    inputSchema: z.object(coordinates),
    execute: async ({ x, y }) => {
      const desktop = await getDesktop()
      await desktop.mouse.move(x, y)
      return { x, y }
    },
  }),

  mouseDrag: tool({
    description:
      "Press the left mouse button at one point, drag to another and release, e.g. to select text or move a window.",
    inputSchema: z.object({
      startX: coordinates.x,
      startY: coordinates.y,
      endX: coordinates.x,
      endY: coordinates.y,
    }),
    execute: async ({ startX, startY, endX, endY }) => {
      const desktop = await getDesktop()
      await desktop.mouse.drag(startX, startY, endX, endY)
      return { x: endX, y: endY }
    },
  }),

  mouseScroll: tool({
    description:
      "Scroll the mouse wheel with the pointer at a point on the screen.",
    inputSchema: z.object({
      ...coordinates,
      direction: z.enum(["up", "down"]),
      amount: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(3)
        .describe("Wheel notches. One notch moves a few lines."),
    }),
    execute: async ({ x, y, direction, amount }) => {
      const desktop = await getDesktop()
      await desktop.mouse.scroll(x, y, direction, amount)
      return { x, y }
    },
  }),

  keyboardType: tool({
    description:
      "Type text into whatever has keyboard focus. Newlines press Enter. Click the field first if it isn't focused.",
    inputSchema: z.object({ text: z.string() }),
    execute: async ({ text }) => {
      const desktop = await getDesktop()
      await desktop.keyboard.type(text)
      return { characters: text.length }
    },
  }),

  keyboardPress: tool({
    description:
      "Press a key, optionally with modifiers held, e.g. enter, escape, tab, backspace, up, f5, or c with ctrl to copy.",
    inputSchema: z.object({
      key: z
        .string()
        .describe(
          "A key name such as enter, escape, tab, backspace, delete, space, home, end, pageup, pagedown, up, down, left, right, f1 to f24, or a single letter, digit or punctuation mark."
        ),
      modifiers: z
        .array(z.enum(["ctrl", "alt", "shift", "cmd"]))
        .default([])
        .describe("Keys to hold while pressing."),
    }),
    execute: async ({ key, modifiers }) => {
      const desktop = await getDesktop()
      await desktop.keyboard.press(key, modifiers)
      return { key, modifiers }
    },
  }),

  viewScreen: tool({
    description:
      "Take a screenshot so you can see the screen yourself. Use it before clicking or typing, and after an action to check it worked. The person can't see this screenshot; use showScreen when they ask what's on the screen.",
    inputSchema: z.object({}),
    execute: screenshot,
    toModelOutput: screenshotToModel,
  }),

  showScreen: tool({
    description:
      "Take a screenshot and show it to the person in the chat. Use it when they ask to see the screen or what you're doing. You see it too.",
    inputSchema: z.object({}),
    execute: screenshot,
    toModelOutput: screenshotToModel,
  }),
} satisfies ToolSet
