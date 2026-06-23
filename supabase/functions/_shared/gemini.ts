const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_FALLBACK_MODEL = "gemini-3.1-flash-lite-preview";
const DEFAULT_RETRY_DELAYS_MS = [1200, 2500];
const CAPACITY_ERROR_PATTERN =
  /high demand|rate limit|too many requests|resource exhausted|try again later|temporarily unavailable/i;

export type ChatMessage = {
  role: "user" | "assistant" | string;
  content: string;
};

export function getGeminiApiKeys(): string[] {
  const configuredKeys = [
    Deno.env.get("GEMINI_API_KEY"),
    Deno.env.get("GEMINI_API_KEY_SECONDARY"),
    ...(Deno.env.get("GEMINI_API_KEYS") || "")
      .split(",")
      .map((value) => value.trim()),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  const uniqueKeys = [...new Set(configuredKeys)];

  if (!uniqueKeys.length) {
    throw new Error("No Gemini API keys are configured");
  }

  return uniqueKeys;
}

export function buildGeminiUrl(
  model: string,
  action: "generateContent" | "streamGenerateContent",
  apiKey: string,
): string {
  const alt = action === "streamGenerateContent" ? "&alt=sse" : "";
  return `${GEMINI_API_BASE}/${model}:${action}?key=${apiKey}${alt}`;
}

export function messagesToGeminiContents(messages: ChatMessage[]) {
  return messages
    .filter((message) => typeof message?.content === "string" && message.content.trim().length > 0)
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
}

export function extractGeminiText(payload: any): string {
  const parts = payload?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part: any) => typeof part?.text === "string" ? part.text : "")
    .join("");
}

export function extractGeminiJson<T>(payload: any): T {
  const text = extractGeminiText(payload).trim();

  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  const normalized = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  return JSON.parse(normalized) as T;
}

export class GeminiApiRequestError extends Error {
  status: number;
  retryAfterMs?: number;
  retryable: boolean;

  constructor(
    message: string,
    status: number,
    options?: {
      retryAfterMs?: number;
      retryable?: boolean;
    },
  ) {
    super(message);
    this.name = "GeminiApiRequestError";
    this.status = status;
    this.retryAfterMs = options?.retryAfterMs;
    this.retryable = options?.retryable ?? isRetryableGeminiStatus(status);
  }
}

function isRetryableGeminiStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 503;
}

function isCapacityMessage(message: string): boolean {
  return CAPACITY_ERROR_PATTERN.test(message);
}

function isApiKeyMessage(message: string): boolean {
  return /api key|credential|permission|forbidden|unauthorized|authentication/i.test(message);
}

function parseRetryDelayMs(message: string): number | undefined {
  const secondsMatch = message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  if (secondsMatch) {
    return Math.ceil(Number(secondsMatch[1]) * 1000);
  }

  const minuteMatch = message.match(/retry in\s+(\d+(?:\.\d+)?)\s+minutes?/i);
  if (minuteMatch) {
    return Math.ceil(Number(minuteMatch[1]) * 60_000);
  }

  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readGeminiApiError(response: Response): Promise<GeminiApiRequestError> {
  const bodyText = await response.text();

  try {
    const parsed = JSON.parse(bodyText);
    const message =
      parsed?.error?.message ||
      parsed?.message ||
      `Gemini API request failed with status ${response.status}`;
    return new GeminiApiRequestError(message, response.status, {
      retryAfterMs: parseRetryDelayMs(message),
      retryable: isRetryableGeminiStatus(response.status) || isCapacityMessage(message),
    });
  } catch {
    return new GeminiApiRequestError(
      bodyText || `Gemini API request failed with status ${response.status}`,
      response.status,
      {
        retryAfterMs: parseRetryDelayMs(bodyText),
        retryable: isRetryableGeminiStatus(response.status) || isCapacityMessage(bodyText),
      },
    );
  }
}

export async function createGeminiApiError(response: Response): Promise<Error> {
  return await readGeminiApiError(response);
}

export function isGeminiCapacityError(error: unknown): error is GeminiApiRequestError {
  return error instanceof GeminiApiRequestError &&
    (error.status === 429 || isCapacityMessage(error.message));
}

function shouldTryNextKey(error: GeminiApiRequestError): boolean {
  return [400, 401, 403, 429, 500, 503].includes(error.status) ||
    isApiKeyMessage(error.message) ||
    isCapacityMessage(error.message);
}

type GeminiGenerateContentOptions = {
  body: unknown;
  model: string;
  fallbackModel?: string;
  maxAttemptsPerModel?: number;
};

export async function generateGeminiContent(
  options: GeminiGenerateContentOptions,
): Promise<any> {
  const {
    body,
    model,
    fallbackModel = DEFAULT_FALLBACK_MODEL,
    maxAttemptsPerModel = 2,
  } = options;

  const apiKeys = getGeminiApiKeys();
  const models = [...new Set([model, fallbackModel].filter(Boolean))];
  let lastError: GeminiApiRequestError | null = null;

  for (const apiKey of apiKeys) {
    for (const currentModel of models) {
      for (let attempt = 0; attempt < maxAttemptsPerModel; attempt += 1) {
        const response = await fetch(buildGeminiUrl(currentModel, "generateContent", apiKey), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          return await response.json();
        }

        const error = await readGeminiApiError(response);
        lastError = error;

        const hasAnotherAttempt = attempt < maxAttemptsPerModel - 1;
        const hasAnotherModel = currentModel !== models[models.length - 1];
        const hasAnotherKey = apiKey !== apiKeys[apiKeys.length - 1];

        if (!error.retryable) {
          if (hasAnotherKey && shouldTryNextKey(error)) {
            break;
          }
          throw error;
        }

        if (!hasAnotherAttempt && !hasAnotherModel && !hasAnotherKey) {
          throw error;
        }

        if (!hasAnotherAttempt) {
          break;
        }

        const retryDelayMs = error.retryAfterMs ??
          DEFAULT_RETRY_DELAYS_MS[Math.min(attempt, DEFAULT_RETRY_DELAYS_MS.length - 1)];
        await sleep(retryDelayMs);
      }
    }
  }

  throw lastError ?? new GeminiApiRequestError("Gemini request failed", 500);
}

export function streamGeminiAsOpenAISse(
  body: ReadableStream<Uint8Array> | null,
  corsHeaders: Record<string, string>,
): Response {
  if (!body) {
    throw new Error("No response stream");
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader();
      let buffer = "";

      const sendChunk = (text: string) => {
        if (!text) return;

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              choices: [{ delta: { content: text } }],
            })}\n\n`,
          ),
        );
      };

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let newlineIndex = buffer.indexOf("\n");
          while (newlineIndex !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) {
              line = line.slice(0, -1);
            }

            if (!line.trim() || line.startsWith(":")) {
              newlineIndex = buffer.indexOf("\n");
              continue;
            }

            if (!line.startsWith("data:")) {
              newlineIndex = buffer.indexOf("\n");
              continue;
            }

            const jsonText = line.slice(5).trim();

            if (!jsonText) {
              newlineIndex = buffer.indexOf("\n");
              continue;
            }

            const payload = JSON.parse(jsonText);
            const text = extractGeminiText(payload);
            sendChunk(text);

            newlineIndex = buffer.indexOf("\n");
          }
        }

        if (buffer.trim().startsWith("data:")) {
          const payload = JSON.parse(buffer.trim().slice(5).trim());
          sendChunk(extractGeminiText(payload));
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
