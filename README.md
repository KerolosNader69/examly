This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Telegram bot (Pro teachers: PDF -> MCQ exam)

Pro teachers send a PDF of multiple-choice questions to the Examly bot on Telegram and get a
ready exam back (time, answer key, publish now or schedule). **v1 is MCQ only** (2-4 options;
questions with 5-6 options are reported to the teacher and not imported).

Everything is **off** unless `TELEGRAM_BOT_ENABLED=true`: the webhook and `/api/teacher/telegram`
answer 404 and the dashboard hides the "Connect Telegram" card.

Code: `lib/telegram/*` (pure state machine in `flow.ts`, I/O in `bot.ts`, wiring in `services.ts`),
`app/api/telegram/webhook/route.ts`, `app/api/teacher/telegram/route.ts`,
`components/dashboard/TelegramConnect.tsx`. Tests: `tests/unit/telegram*.test.ts`.

### 1. Create the bot (@BotFather)

1. In Telegram, open **@BotFather** and send `/newbot`. Pick a name (e.g. "Examly") and a
   username ending in `bot` (e.g. `ExamlyAppBot`).
2. BotFather replies with the **bot token**. Treat it like a password: put it straight into
   Vercel (step 3), never in chat, files or commits. If it ever leaks, `/revoke` it in BotFather.
3. Optional: `/setdescription`, `/setuserpic`. Keep privacy mode on (the bot is for private chats).

### 2. Database (once, before turning the flag on)

Run `supabase/migrations/008_telegram_bot.sql` in the Supabase SQL editor (additive and
idempotent: 4 new service-role-only tables + the private `telegram-pdfs` bucket). The
verification query is at the bottom of the file.

### 3. Environment variables (Vercel -> Project -> Settings -> Environment Variables)

| Variable | Required | Notes |
| --- | --- | --- |
| `TELEGRAM_BOT_ENABLED` | yes | `true` to turn the bot on. Anything else = off. |
| `TELEGRAM_BOT_TOKEN` | yes | From BotFather. Secret. |
| `TELEGRAM_WEBHOOK_SECRET` | yes | 16-256 chars `A-Z a-z 0-9 _ -`. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `TELEGRAM_BOT_USERNAME` | no | Without `@`; shows an "Open in Telegram" link next to the code. |
| `TELEGRAM_MAX_PDFS_PER_DAY` | no | Default 5 per teacher. |
| `TELEGRAM_MAX_PDF_PAGES` | no | Default 30. |

Also used (already set for the app): `GEMINI_API_KEY`, `NEXT_PUBLIC_APP_URL` (links sent to the
teacher), `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`/`_TOKEN` (rate limits).
Redeploy after changing env vars.

### 4. Register the webhook

The script reads the token and secret from the environment and never prints them. From this folder,
with the two values in a git-ignored env file (e.g. `.env.telegram`, created by you locally):

```bash
node --env-file=.env.telegram scripts/telegram-webhook.mjs set https://examly.site
node --env-file=.env.telegram scripts/telegram-webhook.mjs info
```

`set` points Telegram at `https://<site>/api/telegram/webhook` with the secret header, only
`message` and `callback_query` updates, and registers the `/help`, `/cancel`, `/unlink` menu
(English + Arabic). `delete` removes the webhook (the bot then receives nothing).
Use a preview URL instead of production to try it on a preview deployment first (the preview needs
the same env vars).

### 5. How to test

1. Make a test teacher Pro (Admin -> Teachers -> Pro tier).
2. Dashboard -> Settings -> **Telegram Bot** -> **Connect Telegram** -> send `/start <code>` to the bot.
3. Send a PDF with MCQs. Follow the buttons: Looks good -> time -> missing answers -> Publish now or Schedule.
4. Check the exam in Dashboard -> My Exams. Drafts (missing answers) can be completed on the exam page
   (click the correct option) and published there.
5. `/cancel` resets the conversation; `/unlink` or the dashboard **Disconnect** button unlinks.

Behaviour notes: scheduling reuses `exams.start_time` (a scheduled exam is `published` with a future
start time; `/api/exam/join` refuses students before it). The total time is split evenly across the
questions (Examly enforces time per question, 30-600 s each). Times are Africa/Cairo. Sessions expire
after 24 h of inactivity. PDFs are stored in the private `telegram-pdfs` bucket only while they are
read and deleted right after. Logs contain counts only (never PDF content, chat text or names).
