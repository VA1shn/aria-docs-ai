/**
 * Gemini 2.5 Flash client via Google AI Studio (Generative Language API).
 */

const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash";

export type GeminiGenerateOptions = {
  systemPrompt?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Force JSON object response when true */
  jsonMode?: boolean;
  model?: string;
};

export type GeminiClientConfig = {
  apiKey: string;
  model?: string;
};

export class GeminiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

export class GeminiClient {
  private apiKey: string;
  private model: string;

  constructor(config: GeminiClientConfig) {
    if (!config.apiKey) {
      throw new GeminiError("GEMINI_API_KEY is not configured");
    }
    this.apiKey = config.apiKey;
    this.model = config.model ?? DEFAULT_MODEL;
  }

  static fromEnv(): GeminiClient {
    const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
    const model = Deno.env.get("GEMINI_MODEL") ?? DEFAULT_MODEL;
    return new GeminiClient({ apiKey, model });
  }

  /**
   * Generate a text completion from a user prompt (+ optional system prompt).
   */
  async generate(
    userPrompt: string,
    options: GeminiGenerateOptions = {},
  ): Promise<string> {
    const model = options.model ?? this.model;
    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${this.apiKey}`;

    const body: Record<string, unknown> = {
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: options.temperature ?? 0.4,
        maxOutputTokens: options.maxOutputTokens ?? 8192,
        ...(options.jsonMode
          ? { responseMimeType: "application/json" }
          : {}),
      },
    };

    if (options.systemPrompt) {
      body.systemInstruction = {
        parts: [{ text: options.systemPrompt }],
      };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let details: unknown;
      try {
        details = await res.json();
      } catch {
        details = await res.text();
      }
      throw new GeminiError(
        `Gemini API error (${res.status})`,
        res.status,
        details,
      );
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("") ?? "";

    if (!text) {
      throw new GeminiError("Gemini returned an empty response", 502, data);
    }

    return text.trim();
  }

  /**
   * Generate and parse a JSON response.
   */
  async generateJson<T>(
    userPrompt: string,
    options: Omit<GeminiGenerateOptions, "jsonMode"> = {},
  ): Promise<T> {
    const raw = await this.generate(userPrompt, {
      ...options,
      jsonMode: true,
    });
    return JSON.parse(raw) as T;
  }
}
