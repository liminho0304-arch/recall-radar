import { tavily, type TavilySearchResponse } from "@tavily/core";
import { z } from "zod";
import { chatJson, REASONING_MODEL } from "./llm";
import { JudgementSchema, type Alert, type Item } from "./types";

type TavilySearchResult = TavilySearchResponse["results"][number];

// Official US recall sources. Restricting search here keeps results credible
// and saves Tavily credits.
const RECALL_DOMAINS = [
  "cpsc.gov",
  "saferproducts.gov",
  "nhtsa.gov",
  "fda.gov",
  "fsis.usda.gov",
  "recalls.gov",
];

// In-memory cache so repeated scans during dev and demos don't burn credits.
const searchCache = new Map<string, TavilySearchResult[]>();

function query(item: Item): string {
  return [item.brand, item.name, item.model, "recall"].filter(Boolean).join(" ");
}

export async function searchRecalls(item: Item): Promise<TavilySearchResult[]> {
  const q = query(item);
  const cached = searchCache.get(q);
  if (cached) return cached;

  if (!process.env.TAVILY_API_KEY) {
    throw new Error("Missing TAVILY_API_KEY. See README for setup.");
  }
  const client = tavily({ apiKey: process.env.TAVILY_API_KEY });
  const res = await client.search(q, {
    searchDepth: "basic",
    maxResults: 5,
    includeDomains: RECALL_DOMAINS,
  });
  searchCache.set(q, res.results);
  return res.results;
}

const SYSTEM = `You decide whether product recall notices apply to a specific product a person owns.
Compare brand, product name, model or SKU numbers, lot or date ranges and region.
A notice "affects_you" only if brand and product clearly match and nothing (model, dates) rules it out.
Use "possibly" when it is the same brand and product line but the owner's model or date is unknown.
Use "not_a_match" otherwise, including different models, unrelated products or non-recall pages.
Return {"judgements": [{"index", "verdict", "reasoning", "remedy", "hazard"}]} with one entry per notice.
reasoning: one or two plain sentences that cite the deciding detail.
remedy: what the owner should do, from the notice (null if not a match).
hazard: the risk in a few words (null if not a match).`;

export async function judgeRecalls(item: Item, results: TavilySearchResult[]): Promise<Alert[]> {
  if (results.length === 0) return [];

  const notices = results
    .map((r, i) => `[${i}] ${r.title}\n${r.url}\n${r.content.slice(0, 1500)}`)
    .join("\n\n");
  const owned = JSON.stringify({
    name: item.name,
    brand: item.brand,
    model: item.model,
    purchaseDate: item.purchaseDate,
  });

  const { judgements } = await chatJson({
    model: REASONING_MODEL,
    system: SYSTEM,
    user: `Owned product: ${owned}\n\nNotices:\n${notices}`,
    schema: z.object({ judgements: z.array(JudgementSchema) }),
  });

  return judgements
    .filter((j) => results[j.index])
    .map((j) => ({
      verdict: j.verdict,
      title: results[j.index].title,
      url: results[j.index].url,
      reasoning: j.reasoning,
      remedy: j.remedy,
      hazard: j.hazard,
    }));
}
