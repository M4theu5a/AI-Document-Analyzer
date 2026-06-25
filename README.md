# Document Intelligence Workspace

A document intelligence app built with Next.js. Users can upload one or more
PDF/TXT/Markdown files, paste text, generate a structured review, and continue
a grounded chat about the loaded documents.

The app includes authentication, persisted workspaces, token quota tracking,
PDF export, light/dark themes, and production-ready social preview metadata.

## Features

- Multi-document intake: upload up to 5 files at once and keep adding files to
  the same workspace.
- Text intake: paste raw document text when a file is not available.
- Structured review: Summary, Key Points, and Risks & Actions.
- Grounded document chat: ask follow-up questions using the current document
  context and chat history.
- Conversation search: filter messages inside the active document chat.
- Question validation: live character count and length feedback before sending.
- Streaming responses: analysis and chat answers render progressively.
- Upload feedback: simulated progress indicators for selected files.
- Toast notifications: success, duplicate document, export, and error feedback.
- Auth-gated actions: visitors can browse the app, but document upload, paste,
  analysis, chat, and persistence require sign-in.
- Persistent workspaces: chats, documents, messages, and analysis are saved per
  user in PostgreSQL.
- Monthly token quota: each user has a configurable monthly allowance.
- Export: download the structured review and conversation history as PDF or JSON.
- Keyboard shortcuts: `Ctrl+K` focuses search, `Ctrl+N` creates a new document,
  and `Ctrl+Enter` sends a question.
- Error boundary: unexpected client errors render a recovery screen.
- Polished UI: responsive workspace layout, custom favicon, social preview
  image, and light/dark theme support.

## Tech stack

| Area | Technology |
| --- | --- |
| Framework | Next.js App Router, React 19, TypeScript |
| Styling | Tailwind CSS, Phosphor icons |
| Database | PostgreSQL with Prisma 7, `@prisma/adapter-pg`, and `pg` |
| Auth | Email/password, `bcryptjs`, JWT session cookie with `jose` |
| AI | DeepSeek Chat Completions API with streaming |
| Document parsing | `pdf-parse` |
| PDF export | `jspdf` |
| Package manager | Bun or npm |

## Requirements

- Bun 1.x or Node.js/npm
- PostgreSQL database, local or hosted
- DeepSeek API key

## Getting started

Install dependencies with your preferred package manager:

```bash
bun install
# or
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Fill in the variables described below, then apply the database migrations:

```bash
bun run db:migrate
```

Start the development server:

```bash
bun run dev
# or
npm run dev
```

Open:

```txt
http://localhost:3000
```

After changing `prisma/schema.prisma` or applying migrations, restart the dev
server so the running process picks up the regenerated Prisma client.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string. Use SSL for hosted databases. |
| `SESSION_SECRET` | Yes | Secret used to sign the session JWT. Use a long random value. |
| `DEEPSEEK_API_KEY` | Yes | Server-side DeepSeek API key. |
| `DEEPSEEK_MODEL` | No | Model name. Defaults to `deepseek-v4-flash`. |
| `TOKEN_MONTHLY_QUOTA` | No | Monthly token allowance for new users. Defaults to `100000`. |
| `NEXT_PUBLIC_SITE_URL` | No | Public site URL used for social preview metadata. Recommended in production. |

Generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Example hosted database URL:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
```

## Scripts

| Script | Description |
| --- | --- |
| `bun run dev` | Start the development server. |
| `bun run build` | Create a production build. |
| `bun run start` | Run the production build. |
| `bun run lint` | Run ESLint. |
| `bun run typecheck` | Run TypeScript without emitting files. |
| `bun run db:migrate` | Create/apply migrations in development. |
| `bun run db:deploy` | Apply pending migrations in production/CI. |
| `bun run db:generate` | Regenerate the Prisma client. |
| `bun run db:studio` | Open Prisma Studio. |

## Data model

| Model | Purpose |
| --- | --- |
| `User` | Account, password hash, token quota, and usage. |
| `Chat` | A document workspace/conversation owned by a user. |
| `Document` | Uploaded or pasted document content attached to a chat. |
| `Message` | User and assistant messages in the document chat. |

Relations cascade on delete. See `prisma/schema.prisma`.

## API routes

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/extract` | Yes | Extract text from up to 5 PDF/TXT/MD files. |
| `POST` | `/api/analyze` | Yes | Stream a structured review or a grounded chat answer. |
| `GET` | `/api/chats` | Yes | List the current user's chats. |
| `PUT` | `/api/chats/[id]` | Yes | Create or update a chat with documents and messages. |
| `DELETE` | `/api/chats/[id]` | Yes | Delete a chat. |
| `GET` | `/api/tokens` | Yes | Return the current token balance. |
| `POST` | `/api/auth/register` | No | Create an account and start a session. |
| `POST` | `/api/auth/login` | No | Sign in. |
| `POST` | `/api/auth/logout` | No | Clear the session. |
| `GET` | `/api/auth/me` | No | Return the current user or `401`. |

## How it works

- The app uses soft authentication: the main page is browsable, but productive
  actions open the sign-in modal before any document is processed.
- The extract and analyze API routes also enforce authentication server-side.
- The client stores a temporary local workspace while loading, then hydrates from
  the database to avoid flashing the wrong state on refresh.
- Analysis uses streaming so generated content appears progressively.
- Chat persistence is debounced to avoid writing every small UI change.
- Token usage is tracked per user and reset lazily by month.
- Open Graph and Twitter image routes generate the large link preview card.

## Project structure

```txt
app/
  api/
    analyze/      AI analysis and grounded chat streaming
    auth/         register, login, logout, me
    chats/        persisted chat CRUD
    extract/      document text extraction
    tokens/       token balance
  icon.svg        browser tab favicon
  layout.tsx      app metadata and font setup
  login/          auth screen
  opengraph-image.tsx
  page.tsx        main workspace UI
  twitter-image.tsx
components/
  AuthForm.tsx
  review/
    ReviewContent.tsx
lib/
  analysis.ts
  auth.ts
  chats.ts
  exports.ts
  prisma.ts
  risk-groups.ts
  tokens.ts
prisma/
  migrations/
  schema.prisma
middleware.ts
```

## Deployment

The app is ready for Vercel or any Node-capable host with PostgreSQL.

For Vercel, use:

```bash
Install Command: bun install
Build Command: bun run db:deploy && bun run build
```

Set the production environment variables in the Vercel project settings:

```env
DATABASE_URL=postgresql://...
SESSION_SECRET=...
DEEPSEEK_API_KEY=...
DEEPSEEK_MODEL=deepseek-v4-flash
TOKEN_MONTHLY_QUOTA=100000
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
```

For serverless deployments, prefer a pooled PostgreSQL connection string when
your database provider offers one.

## Security notes

- Never commit `.env` files.
- Keep `DEEPSEEK_API_KEY` server-side only.
- Rotate database credentials if they are exposed in chat, logs, screenshots, or
  public issue trackers.
- For a public demo, keep `TOKEN_MONTHLY_QUOTA` conservative because new users
  consume credits from the configured provider key.
