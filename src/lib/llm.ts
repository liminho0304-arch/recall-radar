import OpenAI from "openai";
import type { z } from "zod";

// Token Factory is OpenAI-compatible. Point LLM_BASE_URL at another
// OpenAI-compatible host (e.g. NVIDIA's build.nvidia.com) during development.
const baseURL = process.env.LLM_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1/";
const apiKey = process.env.LLM_API_KEY ?? process.env.NEBIUS_API_KEY;

// Fast model for extraction, reasoning model for the recall match decision.
// Exact IDs depend on the host's model list, so they are set per environment.
export const FAST_MODEL = process.env.FAST_MODEL ?? "nvidia/nemotron-nano";
export const REASONING_MODEL = process.env.REASONING_MODEL ?? "nvidia/nemotron-ultra";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!apiKey) {
    throw new Error("Missing LLM_API_KEY (or NEBIUS_API_KEY). See README for setup.");
  }
  client ??= new OpenAI({ baseURL, apiKey });
  return client;
}

// Pull the first JSON value out of a reply. Reasoning models may wrap it in
// <think> blocks or code fences.
function parseJson(text: string): unknown {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(?:json)?/g, "");
  const start = cleaned.search(/[[{]/);
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (start === -1 || end < start) {
    throw new Error("Model reply contained no JSON");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function chatJson<T>(opts: {
  model: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
}): Promise<T> {
  const res = await getClient().chat.completions.create({
    model: opts.model,
    temperature: 0.1,
    messages: [
      { role: "system", content: `${opts.system}\nRespond with JSON only, no prose.` },
      { role: "user", content: opts.user },
    ],
  });
  const text = res.choices[0]?.message?.content ?? "";
  return opts.schema.parse(parseJson(text));
}
