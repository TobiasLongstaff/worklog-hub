import type { EnvConfig } from "../config/env.ts";

export interface GenerateTextInput {
  system: string;
  prompt: string;
}

export interface AIClient {
  generateText(input: GenerateTextInput): Promise<string>;
}

function createOpenAIClient(apiKey: string, model: string): AIClient {
  return {
    async generateText({ system, prompt }: GenerateTextInput): Promise<string> {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "(sin detalle)");
        throw new Error(`OpenAI API error ${response.status}: ${errText}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };

      const content = data.choices[0]?.message?.content;
      if (!content) throw new Error("OpenAI devolvió una respuesta vacía");
      return content;
    },
  };
}

function createAnthropicClient(apiKey: string, model: string): AIClient {
  return {
    async generateText({ system, prompt }: GenerateTextInput): Promise<string> {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "(sin detalle)");
        throw new Error(`Anthropic API error ${response.status}: ${errText}`);
      }

      const data = (await response.json()) as {
        content: Array<{ type: string; text: string }>;
      };

      const text = data.content.find((c) => c.type === "text")?.text;
      if (!text) throw new Error("Anthropic devolvió una respuesta vacía");
      return text;
    },
  };
}

export function createAIClient(env: EnvConfig): AIClient | null {
  if (!env.aiProvider) return null;

  if (env.aiProvider === "openai") {
    if (!env.openaiApiKey) return null;
    return createOpenAIClient(env.openaiApiKey, env.openaiModel);
  }

  if (env.aiProvider === "anthropic") {
    if (!env.anthropicApiKey) return null;
    return createAnthropicClient(env.anthropicApiKey, env.anthropicModel);
  }

  throw new Error(
    `AI_PROVIDER no soportado: "${env.aiProvider}". Opciones válidas: "openai", "anthropic".`
  );
}
