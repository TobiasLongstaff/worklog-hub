export interface EnvConfig {
  aiProvider: string | null;
  openaiApiKey: string | null;
  openaiModel: string;
  anthropicApiKey: string | null;
  anthropicModel: string;
}

export function loadEnv(): EnvConfig {
  return {
    aiProvider: process.env["AI_PROVIDER"] ?? null,
    openaiApiKey: process.env["OPENAI_API_KEY"] ?? null,
    openaiModel: process.env["OPENAI_MODEL"] ?? "gpt-4o",
    anthropicApiKey: process.env["ANTHROPIC_API_KEY"] ?? null,
    anthropicModel: process.env["ANTHROPIC_MODEL"] ?? "claude-sonnet-4-6",
  };
}

export function hasAIConfigured(env: EnvConfig): boolean {
  if (!env.aiProvider) return false;
  if (env.aiProvider === "openai") return !!env.openaiApiKey;
  if (env.aiProvider === "anthropic") return !!env.anthropicApiKey;
  return false;
}
