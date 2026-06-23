# Document Intelligence Workspace

An AI-powered document analysis workspace built with Next.js. Upload one or more
PDF/TXT/Markdown files (or paste text) and get a structured review — **Summary**,
**Key Points**, and **Risks & Actions** — plus a chat grounded in the loaded
documents. Analyses and chats are persisted per user in PostgreSQL.

---

## Features

- **Multi-document analysis** — upload up to 5 files at once, then keep adding
  more to the same workspace; the review re-runs across all of them.
- **Structured review** — Summary, Key Points, and Risks & Actions, rendered
  with light inline markdown (bold/italic/code).
- **Grounded chat** — ask follow-up questions answered from the loaded documents.
- **Real-time streaming** — answers are written token-by-token as the model
  generates them.
- **Soft authentication** — browse the app freely; a login modal only appears
  when you use a feature (analyze, chat, add documents). Email + password.
- **Monthly token quota** — each user gets a monthly token allowance with a
  live counter in the sidebar; requests are blocked when the balance runs out.
- **Persistence** — chats, documents, messages, and analysis are saved per user.
- **PDF export** — export the analysis or the chat transcript.
- **Light/dark theme**.

## Tech stack

| Area | Technology |
|------|------------|
| Framework | Next.js (App Router), React 19, TypeScript |
| Styling | Tailwind CSS, Phosphor icons |
| Database | PostgreSQL via Prisma 7 (`@prisma/adapter-pg` + `pg`) |
| Auth | `bcryptjs` (password hashing) + `jose` (JWT in an httpOnly cookie) |
| AI | DeepSeek Chat Completions API (streaming) |
| Parsing / export | `pdf-parse`, `jspdf` |
| Package manager | [Bun](https://bun.sh) |

## Prerequisites

- [Bun](https://bun.sh) 1.x
- A running **PostgreSQL** instance (local or hosted)
- A **DeepSeek** API key

## Getting started

```bash
# 1. Install dependencies (also generates the Prisma client)
bun install

# 2. Create your local env file from the template
cp .env.example .env
```

Fill in `.env` (see [Environment variables](#environment-variables) below), then
set up the database schema:

```bash
# 3. Create the database (if needed) and apply migrations
bun run db:migrate

# 4. Start the dev server
bun run dev
```

Open <http://localhost:3000>.

> **Note:** after changing `prisma/schema.prisma` and running a migration,
> **restart `bun run dev`**. The dev server caches the generated Prisma client in
> memory, so a running process won't pick up new fields until restarted.

## Environment variables

All variables live in `.env` (git-ignored). A documented template is in
`.env.example`.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `SESSION_SECRET` | Yes | Secret used to sign the session JWT. Generate a long random value. |
| `DEEPSEEK_API_KEY` | Yes | DeepSeek API key (server-side only; never exposed to the client). |
| `DEEPSEEK_MODEL` | — | Model name. Defaults to `deepseek-v4-flash`. |
| `TOKEN_MONTHLY_QUOTA` | — | Monthly token allowance granted to each new user. Defaults to `100000`. |

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start the dev server. |
| `bun run build` | Production build. |
| `bun run start` | Run the production build. |
| `bun run lint` | Lint with ESLint. |
| `bun run typecheck` | Type-check with `tsc`. |
| `bun run db:migrate` | Create/apply a migration (development). |
| `bun run db:deploy` | Apply pending migrations (production/CI). |
| `bun run db:generate` | Regenerate the Prisma client. |
| `bun run db:studio` | Open Prisma Studio. |

## Data model

| Model | Purpose |
|-------|---------|
| `User` | Account (email, password hash) and token quota (`tokenQuota`, `tokensUsed`, `quotaPeriod`). |
| `Chat` | A workspace/conversation: `title` (renameable), the combined document text, and the analysis. Belongs to a `User`. |
| `Document` | An individual uploaded file (name + extracted text) attached to a `Chat`. |
| `Message` | A chat message (`user` / `assistant`). |

All relations cascade on delete. See [`prisma/schema.prisma`](prisma/schema.prisma).

## API routes

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/extract` | — | Extract text from up to 5 PDF/TXT/MD files (≤ 8 MB each). |
| `POST` | `/api/analyze` | Yes | Stream the analysis or a grounded chat answer; meters and debits tokens. |
| `GET` | `/api/chats` | Yes | List the current user's chats. |
| `PUT` | `/api/chats/[id]` | Yes | Create/update a chat (documents + messages). |
| `DELETE` | `/api/chats/[id]` | Yes | Delete a chat. |
| `GET` | `/api/tokens` | Yes | Current token balance for the user. |
| `POST` | `/api/auth/register` | — | Create an account and start a session. |
| `POST` | `/api/auth/login` | — | Sign in. |
| `POST` | `/api/auth/logout` | — | Clear the session. |
| `GET` | `/api/auth/me` | — | Current user (or `401`). |

## How it works

- **Auth model** — the app is fully browsable without an account. The
  `middleware` only keeps logged-in users away from `/login`; API routes enforce
  `401`. The client gates AI/persistence actions behind a login modal and resumes
  the action after a successful sign-in.
- **Token quota** — `/api/analyze` reads the provider's reported usage and debits
  it from the user's monthly allowance (reset lazily at the start of each month).
  When the balance hits zero, requests return `402` and the UI blocks the action.
- **Streaming** — the analyze route forwards the provider's SSE stream straight to
  the client, so text appears progressively.
- **Persistence** — the client syncs changed chats to the database (debounced);
  documents and messages are stored as related rows.

## Project structure

```
app/
  api/
    analyze/      # AI analysis + chat (streaming, token metering)
    auth/         # register, login, logout, me
    chats/        # CRUD for persisted chats
    extract/      # file text extraction
    tokens/       # token balance
  login/          # auth screen
  page.tsx        # main workspace UI
components/
  AuthForm.tsx    # shared sign in / create account form (page + modal)
lib/
  analysis.ts     # parse the model output into sections
  auth.ts         # password hashing, JWT, session helpers
  chats.ts        # chat persistence + DTO mappers
  prisma.ts       # Prisma client (pg driver adapter)
  tokens.ts       # monthly token quota logic
prisma/
  schema.prisma   # data model
  migrations/      # SQL migrations
middleware.ts     # /login redirect for authenticated users
```

## Deployment

The app runs on any Node-capable host (e.g. Vercel) plus a hosted PostgreSQL
(e.g. Neon, Supabase).

1. Set the environment variables from the table above in the host's project
   settings.
2. Apply migrations during the build/release step: `bun run db:deploy`.
3. For serverless, prefer a **pooled** PostgreSQL connection string to avoid
   exhausting connections.

> Security: `.env` and the generated Prisma client (`lib/generated/prisma`) are
> git-ignored. The DeepSeek key is only ever used server-side. For a public demo,
> consider lowering `TOKEN_MONTHLY_QUOTA`, since open sign-up means new accounts
> consume the configured key's credits (bounded by the quota).
