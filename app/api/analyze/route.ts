import { getSessionUser } from "@/lib/auth";
import { getTokenStatus, recordUsage } from "@/lib/tokens";

export const runtime = "nodejs";

type AnalyzeBody = {
  mode?: "analysis" | "question";
  documentText?: string;
  question?: string;
  chatHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

const encoder = new TextEncoder();
const DEEPSEEK_CHAT_URL = "https://api.deepseek.com/chat/completions";

type StreamChunk = {
  choices?: Array<{ delta?: { content?: string } }>;
  usage?: { total_tokens?: number };
};

export async function POST(request: Request) {
  // AI-consuming feature: requires login.
  const user = await getSessionUser();
  if (!user) {
    return new Response("Sign in to use analysis.", { status: 401 });
  }

  // Block when the monthly token quota has been exhausted.
  const tokenStatus = await getTokenStatus(user.id);
  if (tokenStatus && tokenStatus.remaining <= 0) {
    return new Response("You've run out of tokens for this month.", { status: 402 });
  }

  const body = (await request.json()) as AnalyzeBody;
  const documentText = body.documentText?.trim();

  if (!documentText) {
    return new Response("Document text is required.", { status: 400 });
  }

  if (documentText.length > 120_000) {
    return new Response("Document is too long for this demo. Try a shorter extract.", {
      status: 413,
    });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return new Response("DEEPSEEK_API_KEY is missing on the server.", { status: 500 });
  }

  const prompt =
    body.mode === "question"
      ? buildQuestionPrompt(documentText, body.question, body.chatHistory)
      : buildAnalysisPrompt(documentText);

  const upstream = await fetch(DEEPSEEK_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
      messages: [
        {
          role: "system",
          content:
            "You are a precise AI document intelligence analyst for business operations.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      stream: true,
      stream_options: { include_usage: true },
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errorText = await readProviderError(upstream);
    return new Response(errorText, {
      status: upstream.status || 502,
    });
  }

  const userId = user.id;
  const promptChars = prompt.length;

  // Forward the provider's token stream to the client as it is generated, so the
  // answer is written gradually. Tokens are debited once the stream completes.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let usedTokens = 0;
      let outputChars = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data) as StreamChunk;
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                outputChars += delta.length;
                controller.enqueue(encoder.encode(delta));
              }
              if (json.usage?.total_tokens) usedTokens = json.usage.total_tokens;
            } catch {
              // ignore keep-alive / malformed lines
            }
          }
        }
      } catch (error) {
        controller.error(error);
        return;
      }

      // Fallback rough estimate if the provider didn't report usage.
      if (usedTokens <= 0) usedTokens = Math.ceil((promptChars + outputChars) / 4);
      try {
        await recordUsage(userId, usedTokens);
      } catch (error) {
        console.error("Failed to record token usage", error);
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

async function readProviderError(response: Response) {
  const fallback = "AI provider request failed. Please try again.";
  const text = await response.text();

  try {
    const payload = JSON.parse(text) as {
      error?: {
        code?: string;
        message?: string;
        type?: string;
      };
    };

    const code = payload.error?.code;
    const message = payload.error?.message;

    if (code === "insufficient_quota") {
      return "AI provider quota exceeded. Check your API billing/credits, then try again.";
    }

    return message || fallback;
  } catch {
    return text || fallback;
  }
}

function buildAnalysisPrompt(documentText: string) {
  return `You are an AI document intelligence analyst for a business operations team.

Analyze the document(s) below. Be concise, practical, and specific. If a document is an invoice, contract, policy, or report, call out operational implications.

The text may contain MULTIPLE documents, separated by "---" and labeled "Document N: <name>". Analyze them together as a single set and produce ONE consolidated response.

Return exactly these sections and labels, and output each label EXACTLY ONCE (do not repeat the sections per document):

SUMMARY:
Write a clear executive summary in 4-6 sentences covering all documents.

KEY_POINTS:
- Extract 5-8 important facts, obligations, numbers, dates, entities, or decisions across all documents.

RISKS_ACTIONS:
- Extract risks, missing information, follow-up questions, and suggested next actions across all documents.

Document(s):
"""${documentText}"""`;
}

function buildQuestionPrompt(
  documentText: string,
  question?: string,
  chatHistory: AnalyzeBody["chatHistory"] = [],
) {
  const history = chatHistory
    .slice(-8)
    .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`)
    .join("\n\n");

  return `You are answering questions about a business document. Use only the document text and the conversation history. If the answer is not present, say what is missing and suggest how to verify it.

Conversation history:
${history || "No previous messages."}

Question:
${question?.trim() || "What should I know about this document?"}

Document:
"""${documentText}"""`;
}
