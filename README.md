# Document Intelligence Workspace

A Xenet-inspired intelligent document processing workspace built with Next.js,
TypeScript, Tailwind CSS, and DeepSeek-backed document review.

The app lets a user upload one or more PDFs/text files or paste document text,
then produces:

- Summary
- Key points
- Risks and action items
- A persistent document workspace for contextual follow-up prompts

## Why this project

This tech test mirrors a real business use case: automated processing for
contracts, invoices, service agreements, and policies. It is intentionally built
as a small product surface rather than a raw API demo, with loading states,
error handling, streaming responses, and a responsive dashboard UI.

## Tech stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- DeepSeek Chat Completions API
- `pdf-parse` for server-side PDF text extraction
- Vercel-ready deployment

## Getting started

Install dependencies:

```bash
bun install
```

Create an environment file:

```bash
cp .env.example .env.local
```

Set your DeepSeek key:

```bash
DEEPSEEK_API_KEY=sk-your-deepseek-key-here
DEEPSEEK_MODEL=deepseek-v4-flash
```

Run the development server:

```bash
bun dev
```

Open `http://localhost:3000`.

## API routes

- `POST /api/extract` receives up to five PDF, TXT, or Markdown files and extracts text.
- `POST /api/analyze` streams either the fixed analysis or a contextual response.

## Deployment

Deploy to Vercel and add these environment variables in the project settings:

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL`

The default model is `deepseek-v4-flash` if `DEEPSEEK_MODEL` is not set.
