"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"

import {
  createGroupChat,
  deleteGroupChat,
  updateGroupChat,
} from "@/actions/chat"
import { ChatAvatar } from "@/components/chat-avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import {
  insertGroupChatSchema,
  type Bot,
  type InsertGroupChat,
} from "@/lib/db/schema"

function emptyGroupChat(): InsertGroupChat {
  return { name: "", botIds: [] }
}

function groupChatValues(chat: GroupChat): InsertGroupChat {
  return { name: chat.name, botIds: chat.botIds }
}

type GroupChat = InsertGroupChat & { id: string }

// Creates a group chat, or edits `chat` when one is passed.
function GroupChatDialog({
  bots,
  chat,
  children,
  open: openProp,
  onOpenChange,
}: {
  bots: Bot[]
  chat?: GroupChat
  children?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const router = useRouter()
  const [openState, setOpenState] = React.useState(false)
  const open = openProp ?? openState
  const setOpen = onOpenChange ?? setOpenState
  const form = useForm<InsertGroupChat>({
    resolver: zodResolver(insertGroupChatSchema),
    defaultValues: chat ? groupChatValues(chat) : emptyGroupChat(),
  })

  // Editing always starts from the saved chat, dropping any cancelled changes.
  function handleOpenChange(next: boolean) {
    if (next && chat) form.reset(groupChatValues(chat))
    setOpen(next)
  }

  async function onSubmit(values: InsertGroupChat) {
    const result = chat
      ? await updateGroupChat(chat.id, values)
      : await createGroupChat(values)
    if ("error" in result) {
      toast.add({ title: result.error, type: "error" })
      return
    }
    toast.add({
      title: chat
        ? `${result.chat.name} is updated.`
        : `${result.chat.name} is ready.`,
      type: "success",
    })
    setOpen(false)
    if (chat) {
      form.reset(values)
    } else {
      form.reset(emptyGroupChat())
      router.push(`/chats/${result.chat.id}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children && <DialogTrigger render={children} />}
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>
              {chat ? "Edit group chat" : "New group chat"}
            </DialogTitle>
            <DialogDescription>
              {chat
                ? "Rename the group or change which bots are in it."
                : "Name the group and pick which bots are in it."}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="group-chat-name">Name</FieldLabel>
                  <Input
                    {...field}
                    id="group-chat-name"
                    placeholder="Weekend plans"
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="botIds"
              control={form.control}
              render={({ field, fieldState }) => (
                <FieldSet data-invalid={fieldState.invalid}>
                  <FieldLegend variant="label">Bots</FieldLegend>
                  <FieldGroup data-slot="checkbox-group" className="gap-3">
                    {bots.map((bot) => (
                      <Field
                        key={bot.id}
                        orientation="horizontal"
                        data-invalid={fieldState.invalid}
                      >
                        <Checkbox
                          id={`group-chat-bot-${bot.id}`}
                          checked={field.value.includes(bot.id)}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked
                                ? [...field.value, bot.id]
                                : field.value.filter((id) => id !== bot.id)
                            )
                          }
                          aria-invalid={fieldState.invalid}
                        />
                        <FieldLabel
                          htmlFor={`group-chat-bot-${bot.id}`}
                          className="font-normal"
                        >
                          <ChatAvatar seed={bot.avatar} className="size-6" />
                          {bot.name}
                        </FieldLabel>
                      </Field>
                    ))}
                  </FieldGroup>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </FieldSet>
              )}
            />
          </FieldGroup>
          <DialogFooter>
            {chat && (
              <DeleteGroupChatButton
                chat={chat}
                onDeleted={() => setOpen(false)}
              />
            )}
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && (
                <Spinner data-icon="inline-start" />
              )}
              {chat ? "Save changes" : "Create group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Asks before deleting, since the conversation goes with it.
function DeleteGroupChatButton({
  chat,
  onDeleted,
}: {
  chat: GroupChat
  onDeleted: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  async function handleDelete() {
    setIsDeleting(true)
    const result = await deleteGroupChat(chat.id)
    setIsDeleting(false)
    if ("error" in result) {
      toast.add({ title: result.error, type: "error" })
      return
    }
    toast.add({ title: `${result.chat.name} is deleted.`, type: "success" })
    setOpen(false)
    onDeleted()
    // The chat is gone, so leave the page.
    router.replace("/")
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button type="button" variant="destructive" className="sm:mr-auto" />
        }
      >
        <Trash2Icon data-icon="inline-start" />
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {chat.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Its messages go with it. The bots stay. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            variant="destructive"
            disabled={isDeleting}
            onClick={handleDelete}
          >
            {isDeleting && <Spinner data-icon="inline-start" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { GroupChatDialog }
