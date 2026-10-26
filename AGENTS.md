<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Git

- Never create branches, worktrees, or commits automatically. Only do so when the user explicitly asks for that specific ation in the current request.
- Leave changes uncommitted in the working tree on the current branch and let the user decide when and how to commit.

## Database

- This is a development project. There is no backwards compatibility and the data is worthless. Prefer data loss: never backfill, migrate, or preserve existing rows, and never spend effort on keeping old data working. Every schema change means a clean slate.
- Apply schema changes only with `npm run db:push` (`drizzle-kit push`). Never generate or run migrations (`drizzle-kit generate`, `drizzle-kit migrate`, or migration files), even if a skill or doc recommends them.

## Forms

Reference implementation: `lib/db/schema.ts` (`insertBotSchema`), `actions/bot.ts` (`createBot`), `components/bot-dialog.tsx` (`BotDialog`).

### Schema

- Derive form schemas from the Drizzle table with `createInsertSchema` from `drizzle-zod`, and export them from `lib/db/schema.ts` next to the table. Don't hand-write a parallel zod object.
- `.pick()` only the fields the user fills in. Never include server-owned fields such as `id`, `userId`, `createdAt` or `sandboxId`.
- Put validation and user-facing messages in the refinements, e.g. `name: (s) => s.trim().min(1, "Give your bot a name.").max(50)`.
- Keep a field's input type and output type the same, so one `z.infer` type serves the form, the resolver and the action. For nullable or defaulted columns, pass a plain zod schema (e.g. `z.string().trim().max(2000)`) instead of a refinement callback. That keeps the field a required `string` instead of `string | null | undefined`, which also keeps inputs controlled. Turn `""` into `null` in the action.
- Export the inferred type (`export type InsertBot = z.infer<typeof insertBotSchema>`) and use it everywhere.
- `lib/db/schema.ts` must stay importable from client components: no `server-only` and no imports of `lib/db/index.ts`.

### Server actions

- Put actions in `actions/<entity>.ts` with `"use server"` at the top. Name them by verb and entity (`createBot`).
- Take the typed object (`input: InsertBot`), not `FormData`.
- Start every action with `const { userId } = await auth.protect()` from `@clerk/nextjs/server`. Take `userId` only from Clerk, never from the client.
- Validate again on the server with `schema.safeParse(input)`. Client validation can be bypassed.
- Return a discriminated result such as `{ bot } | { error: string }` for expected failures; don't throw.
- Call `revalidatePath` from `next/cache` after a mutation that changes what a page shows.

### Client form components

- Put the component in `components/<entity>-dialog.tsx` with `"use client"`, and wrap the form in the shadcn `Dialog`. To open it from a Server Component, take the trigger as `children: React.ReactElement` and render `<DialogTrigger render={children} />`. This project uses Base UI (`render`), not Radix (`asChild`).
- Build the form with `useForm<T>({ resolver: zodResolver(schema), defaultValues })`, using the same schema the action uses.
- Wire every input through `Controller` with the shadcn field pattern:

  ```tsx
  <Controller
    name="name"
    control={form.control}
    render={({ field, fieldState }) => (
      <Field data-invalid={fieldState.invalid}>
        <FieldLabel htmlFor="bot-name">Name</FieldLabel>
        <Input {...field} id="bot-name" aria-invalid={fieldState.invalid} />
        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
      </Field>
    )}
  />
  ```

- Lay fields out with `FieldGroup` + `Field`. Use `Field orientation="horizontal"` with `FieldContent`, `FieldTitle` and `FieldDescription` for rows that aren't text inputs. Never use `space-y-*`.
- Read values reactively with `useWatch({ control, name })`, not `form.watch()`, which the React Compiler lint rejects.
- Set values programmatically, e.g. from a preset or a shuffle button, with `form.setValue(name, value, { shouldValidate: true })`.
- Give every non-submit button inside a form `type="button"`.
- Footer: Cancel is `<DialogClose render={<Button type="button" variant="outline" />}>`. The submit button is `disabled={form.formState.isSubmitting}` and shows `<Spinner data-icon="inline-start" />` while submitting. Button has no loading prop.
- On success: `toast.add({ title, type: "success" })` from `@/components/ui/toast`, close the dialog, then call `form.reset()` with fresh defaults. On `{ error }`: `toast.add({ title: error, type: "error" })` and keep the dialog open.
- Generate random defaults such as avatar seeds in a factory function (`emptyBot()`) so `reset()` gets new values each time.

### Dependencies

- Form stack: `react-hook-form`, `@hookform/resolvers`, `zod` (v4), `drizzle-zod`.
- `@hookform/resolvers` declares optional peers (`@typeschema/*`, `effect`) that conflict with installed versions. Install it with `npm i --legacy-peer-deps`. The conflict is only in adapters this project doesn't use.

## DiceBear

Use DiceBear 10. Documentation: https://www.dicebear.com/llms.txt

There are seven native cores with identical output, not one library with
wrappers. Use the one matching this project's language. Do not reach for the
JavaScript core when the project is written in something else:

    JavaScript  @dicebear/core + @dicebear/styles
    PHP         dicebear/core + dicebear/styles
    Python      dicebear-core + dicebear-styles
    Rust        dicebear-core + dicebear-styles
    Go          github.com/dicebear/dicebear-go/v10 + github.com/dicebear/styles/v10
    Dart        dicebear_core + dicebear_styles
    C#          DiceBear.Core + DiceBear.Styles

Every style page carries a loading snippet for all seven, for example
https://www.dicebear.com/styles/lorelei/index.md

HTTP API: https://api.dicebear.com/10.x/<style>/svg?seed=<seed> The seed is a
query parameter, not a path segment. Options are query parameters too; array
values are separated by commas.

Options named after a component end in Variant: eyesVariant, not eyes. This
holds in all seven cores and in the HTTP API. Look up the options of a style at
https://api.dicebear.com/10.x/<style>/options.json

Write these forms, not the ones on the left. The left column is pre-10 and the
API does not reject it, so an outdated call runs and silently does the wrong
thing:

    avatars.dicebear.com/api/<style>/<seed>.svg  ->  api.dicebear.com/10.x/<style>/svg?seed=<seed>
    api.dicebear.com/9.x/<style>/svg             ->  api.dicebear.com/10.x/<style>/svg
    npm install @dicebear/collection             ->  npm install @dicebear/styles
    npm install @dicebear/lorelei                ->  npm install @dicebear/styles
    createAvatar(lorelei, { seed })              ->  new Avatar(new Style(definition), { seed })
    { eyes: ['variant01'] }                      ->  { eyesVariant: ['variant01'] }
    ?radius=50                                   ->  ?borderRadius=50

Only JavaScript and the HTTP API have a pre-10 form. The other six cores were
released in 2026 and never had one, so any older-looking PHP, Python, Rust, Go,
Dart or C# API attributed to DiceBear is invented rather than outdated.

<!-- TRIGGER.DEV SKILLS START -->
## Trigger.dev agent skills

This project has Trigger.dev agent skills installed in `.agents/skills/`. Before writing or changing Trigger.dev code (background tasks, scheduled tasks, realtime, or chat.agent AI agents), load the most relevant skill: `trigger-authoring-chat-agent`, `trigger-authoring-tasks`, `trigger-chat-agent-advanced`, `trigger-cost-savings`, `trigger-getting-started`, `trigger-realtime-and-frontend`.
<!-- TRIGGER.DEV SKILLS END -->
