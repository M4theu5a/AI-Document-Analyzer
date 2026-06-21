# AI Document Analyzer

A Xenet-inspired intelligent document processing workspace built with Next.js,
TypeScript, Tailwind CSS, and DeepSeek-powered AI responses.

The app lets a user upload a PDF or paste document text, then uses an LLM to
produce:

- Summary
- Key points
- Risks and action items
- Free-form Q&A grounded in the document

## Why this project

This tech test mirrors a real business use case: AI-assisted processing for
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
pnpm install
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
pnpm dev
```

Open `http://localhost:3000`.

## API routes

- `POST /api/extract` receives a PDF, TXT, or Markdown file and extracts text.
- `POST /api/analyze` streams either the fixed analysis or a Q&A answer.

## Deployment

Deploy to Vercel and add these environment variables in the project settings:

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL`

The default model is `deepseek-v4-flash` if `DEEPSEEK_MODEL` is not set.
