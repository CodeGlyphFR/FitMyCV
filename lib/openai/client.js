import OpenAI from 'openai';

const ANALYSIS_MODEL_MAP = Object.freeze({
  rapid: "gpt-5-nano-2025-08-07",
  medium: "gpt-5-mini-2025-08-07",
  deep: "gpt-5-2025-08-07",
});

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY est manquant.");
  }

  const client = new OpenAI({ apiKey });
  return client;
}

export function getModelForAnalysisLevel(analysisLevel, requestedModel = null) {
  return (
    requestedModel ||
    process.env.GPT_OPENAI_MODEL ||
    process.env.OPENAI_MODEL ||
    process.env.OPENAI_API_MODEL ||
    ANALYSIS_MODEL_MAP[analysisLevel] ||
    ANALYSIS_MODEL_MAP.medium
  );
}
