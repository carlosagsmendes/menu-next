import "server-only";

export type LMStudioConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
};

const DEFAULT_LMSTUDIO_BASE_URL = "http://127.0.0.1:1234/v1";
const DEFAULT_LMSTUDIO_API_KEY = "lmstudio";
const DEFAULT_LMSTUDIO_MODEL = "qwen/qwen3.5-35b-a3b";

export function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function optional(key: string, fallback: string = ""): string {
  return process.env[key] ?? fallback;
}

export function getLMStudioConfig(): LMStudioConfig {
  return {
    baseURL: optional("LMSTUDIO_BASE_URL", DEFAULT_LMSTUDIO_BASE_URL),
    apiKey: optional("LMSTUDIO_API_KEY", DEFAULT_LMSTUDIO_API_KEY),
    model: optional("LMSTUDIO_MODEL", DEFAULT_LMSTUDIO_MODEL),
  };
}
