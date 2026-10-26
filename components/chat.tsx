"use client"

import { useChat } from "@ai-sdk/react"
import type { TriggerChatTransport } from "@trigger.dev/sdk/chat"
import {
  useLoadTranscript,
  useTriggerChatTransport,
} from "@trigger.dev/sdk/chat/react"
import { isToolUIPart } from "ai"
import {
  EyeIcon,
  FilePenIcon,
  FileTextIcon,
  FolderOpenIcon,
  KeyboardIcon,
  MonitorIcon,
  MouseIcon,
  MousePointer2Icon,
  MousePointerClickIcon,
  MoveIcon,
  TerminalIcon,
} from "lucide-react"
import { useState } from "react"

import {
  loadTranscript,
  mintChatAccessToken,
  startChatSession,
} from "@/actions/chat"

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import { CodeBlock, CodeBlockContent } from "@/components/ui/code-block"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"
import type { ChatUIMessage, chatAgent } from "@/trigger/chat"

type Part = ChatUIMessage["parts"][number]
type ToolPart = Extract<Part, { type: `tool-${string}` }>
type Screenshot = Extract<
  ToolPart,
  { type: "tool-showScreen"; state: "output-available" }
>

export function Chat({ id }: { id: string }) {
  const transport = useTriggerChatTransport<typeof chatAgent>({
    task: "chat",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
  })
  const { messages, isLoading } = useLoadTranscript(id, loadTranscript, {
    transport,
  })

  // useChat only reads its initial messages once, so wait for the transcript.
  if (isLoading) return null

  // The load action isn't generic, but the transcript is what this agent wrote.
  return (
    <ChatView
      id={id}
      initialMessages={messages as ChatUIMessage[]}
      transport={transport}
    />
  )
}

function ChatView({
  id,
  initialMessages,
  transport,
}: {
  id: string
  initialMessages: ChatUIMessage[]
  transport: TriggerChatTransport
}) {
  const [input, setInput] = useState("")
  const { messages, sendMessage, status, stop } = useChat<ChatUIMessage>({
    id,
    messages: initialMessages,
    transport,
  })

  function handleSubmit(message: PromptInputMessage) {
    if (!message.text.trim()) return
    sendMessage({ text: message.text })
    setInput("")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation>
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent>
                {groupParts(message.parts).map((block, i) => {
                  switch (block.type) {
                    case "text":
                      return (
                        <MessageResponse key={i}>{block.text}</MessageResponse>
                      )
                    case "screenshot":
                      return <ScreenshotImage key={i} part={block.part} />
                    case "trace":
                      return (
                        <Trace key={i}>
                          {block.parts.map((part) => (
                            <ToolRow key={part.toolCallId} part={part} />
                          ))}
                        </Trace>
                      )
                  }
                })}
              </MessageContent>
            </Message>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl p-4 pt-0">
        <PromptInput onSubmit={handleSubmit} className="relative">
          <PromptInputTextarea
            value={input}
            placeholder="Say something..."
            onChange={(e) => setInput(e.currentTarget.value)}
            className="pr-12"
          />
          <PromptInputSubmit
            status={status}
            onStop={stop}
            disabled={status === "ready" && !input.trim()}
            className="absolute right-1 bottom-1"
          />
        </PromptInput>
      </div>
    </div>
  )
}

type Block =
  | { type: "text"; text: string }
  | { type: "screenshot"; part: Screenshot }
  | { type: "trace"; parts: ToolPart[] }

// Consecutive tool calls share one Trace. Text and shown screenshots end the
// run. Other parts, such as step boundaries, render nothing and don't.
function groupParts(parts: Part[]) {
  const blocks: Block[] = []
  for (const part of parts) {
    if (part.type === "text") {
      blocks.push({ type: "text", text: part.text })
    } else if (
      part.type === "tool-showScreen" &&
      part.state === "output-available"
    ) {
      blocks.push({ type: "screenshot", part })
    } else if (isToolUIPart(part) && part.type !== "dynamic-tool") {
      const last = blocks.at(-1)
      if (last?.type === "trace") last.parts.push(part)
      else blocks.push({ type: "trace", parts: [part] })
    }
  }
  return blocks
}

function ScreenshotImage({ part }: { part: Screenshot }) {
  return (
    // A data URL has nothing for next/image to optimize.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`data:${part.output.mediaType};base64,${part.output.image}`}
      alt="Screenshot of the bot's screen"
      className="h-auto w-full rounded-lg border"
    />
  )
}

type Row = {
  icon: React.ReactNode
  // What the line says while running, once done, and when it failed.
  title: [running: string, done: string, failed: string]
  description?: string
  // Shown when the line is expanded.
  detail?: string
}

function ToolRow({ part }: { part: ToolPart }) {
  const row = describe(part)
  const status =
    part.state === "output-error" || part.state === "output-denied"
      ? "error"
      : part.state === "input-streaming" || part.state === "input-available"
        ? "running"
        : undefined
  const [running, done, failed] = row.title
  const error = part.state === "output-error" ? part.errorText : undefined

  const line = (
    <TraceLine status={status}>
      <TraceIcon>{row.icon}</TraceIcon>
      <TraceTitle>
        {status === "running" ? running : status === "error" ? failed : done}
      </TraceTitle>
      {row.description && (
        <TraceDescription>{row.description}</TraceDescription>
      )}
    </TraceLine>
  )

  const detail = error ?? (status === undefined ? row.detail : undefined)
  if (detail === undefined) return line

  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <CodeBlock size="sm" variant={error ? "destructive" : "default"}>
          <CodeBlockContent wrap className="max-h-64">
            {detail}
          </CodeBlockContent>
        </CodeBlock>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  )
}

function describe(part: ToolPart): Row {
  // Input streams in, so any field can still be missing while running.
  switch (part.type) {
    case "tool-bash": {
      const command = part.input?.command ?? ""
      const output = part.state === "output-available" ? part.output : undefined
      return {
        icon: <TerminalIcon />,
        title: [
          `Running ${command}`,
          `Ran ${command}`,
          `Failed to run ${command}`,
        ],
        description:
          output && output.exitCode !== 0
            ? `exit ${output.exitCode}`
            : undefined,
        detail: output && `$ ${command}\n${output.output}`,
      }
    }
    case "tool-readFile": {
      const path = part.input?.path ?? ""
      return {
        icon: <FileTextIcon />,
        title: [`Reading ${path}`, `Read ${path}`, `Failed to read ${path}`],
        detail:
          part.state === "output-available" ? part.output.content : undefined,
      }
    }
    case "tool-writeFile": {
      const path = part.input?.path ?? ""
      return {
        icon: <FilePenIcon />,
        title: [`Writing ${path}`, `Wrote ${path}`, `Failed to write ${path}`],
        detail: part.input?.content,
      }
    }
    case "tool-listFiles": {
      const path = part.input?.path ?? "."
      const entries =
        part.state === "output-available" ? part.output.entries : undefined
      return {
        icon: <FolderOpenIcon />,
        title: [`Listing ${path}`, `Listed ${path}`, `Failed to list ${path}`],
        description: entries && `${entries.length} items`,
        detail:
          entries &&
          entries
            .map((entry) => (entry.isDir ? `${entry.name}/` : entry.name))
            .join("\n"),
      }
    }
    case "tool-mouseClick": {
      const at = point(part.input?.x, part.input?.y)
      const verb = [
        part.input?.button === "right" && "Right",
        part.input?.button === "middle" && "Middle",
        part.input?.double && "Double",
      ]
        .filter(Boolean)
        .join("-")
      return {
        icon: <MousePointerClickIcon />,
        title: verb
          ? [
              `${verb}-clicking at ${at}`,
              `${verb}-clicked at ${at}`,
              `Failed to ${verb.toLowerCase()}-click at ${at}`,
            ]
          : [
              `Clicking at ${at}`,
              `Clicked at ${at}`,
              `Failed to click at ${at}`,
            ],
      }
    }
    case "tool-mouseMove": {
      const to = point(part.input?.x, part.input?.y)
      return {
        icon: <MousePointer2Icon />,
        title: [
          `Moving the pointer to ${to}`,
          `Moved the pointer to ${to}`,
          `Failed to move the pointer to ${to}`,
        ],
      }
    }
    case "tool-mouseDrag": {
      const from = point(part.input?.startX, part.input?.startY)
      const to = point(part.input?.endX, part.input?.endY)
      return {
        icon: <MoveIcon />,
        title: [
          `Dragging from ${from} to ${to}`,
          `Dragged from ${from} to ${to}`,
          `Failed to drag from ${from} to ${to}`,
        ],
      }
    }
    case "tool-mouseScroll": {
      const direction = part.input?.direction ?? "down"
      const at = point(part.input?.x, part.input?.y)
      return {
        icon: <MouseIcon />,
        title: [
          `Scrolling ${direction} at ${at}`,
          `Scrolled ${direction} at ${at}`,
          `Failed to scroll ${direction} at ${at}`,
        ],
      }
    }
    case "tool-keyboardType": {
      const text = part.input?.text ?? ""
      return {
        icon: <KeyboardIcon />,
        title: [`Typing “${text}”`, `Typed “${text}”`, `Failed to type`],
        detail: text,
      }
    }
    case "tool-keyboardPress": {
      const keys = [...(part.input?.modifiers ?? []), part.input?.key ?? ""]
        .map(keyLabel)
        .join("+")
      return {
        icon: <KeyboardIcon />,
        title: [
          `Pressing ${keys}`,
          `Pressed ${keys}`,
          `Failed to press ${keys}`,
        ],
      }
    }
    case "tool-viewScreen":
      return {
        icon: <EyeIcon />,
        title: [
          "Looking at the screen",
          "Looked at the screen",
          "Failed to look at the screen",
        ],
      }
    case "tool-showScreen":
      return {
        icon: <MonitorIcon />,
        title: [
          "Taking a screenshot",
          "Took a screenshot",
          "Failed to take a screenshot",
        ],
      }
  }
}

function point(x: number | undefined, y: number | undefined) {
  return `(${x ?? "…"}, ${y ?? "…"})`
}

function keyLabel(key: string | undefined) {
  if (!key) return "…"
  return key.length === 1
    ? key.toUpperCase()
    : key[0].toUpperCase() + key.slice(1)
}
