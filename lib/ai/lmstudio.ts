import "server-only";

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import { getLMStudioConfig } from "@/lib/env";

const lmstudioConfig = getLMStudioConfig();

const lmstudio = createOpenAICompatible({
  name: "lmstudio",
  baseURL: lmstudioConfig.baseURL,
  apiKey: lmstudioConfig.apiKey,
  supportsStructuredOutputs: true,
});

export function getLMStudioProofreadModel() {
  return lmstudio(lmstudioConfig.model);
}
