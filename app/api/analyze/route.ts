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

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export async function POST(request: Request) {
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
    }),
  });

  if (!upstream.ok) {
    const errorText = await readProviderError(upstream);
    return new Response(errorText, {
      status: upstream.status || 502,
    });
  }

  const payload = (await upstream.json()) as ChatCompletionResponse;
  const outputText = extractResponseText(payload);

  if (!outputText) {
    return new Response("The AI provider returned an empty response.", { status: 502 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (const chunk of chunkText(outputText)) {
          controller.enqueue(encoder.encode(chunk));

          if (chunk.trim()) {
            await new Promise((resolve) => setTimeout(resolve, 18));
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

function extractResponseText(payload: ChatCompletionResponse) {
  return payload.choices?.[0]?.message?.content?.trim() ?? "";
}

function chunkText(value: string) {
  const chunks = value.match(/\S+\s*/g);
  return chunks ?? [value];
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

Analyze the document below. Be concise, practical, and specific. If the document is an invoice, contract, policy, or report, call out operational implications.

Return exactly these sections and labels:

SUMMARY:
Write a clear executive summary in 4-6 sentences.

KEY_POINTS:
- Extract 5-8 important facts, obligations, numbers, dates, entities, or decisions.

RISKS_ACTIONS:
- Extract risks, missing information, follow-up questions, and suggested next actions.

Document:
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
