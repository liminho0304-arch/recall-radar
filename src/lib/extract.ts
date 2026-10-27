import { z } from "zod";
import { chatJson, FAST_MODEL } from "./llm";
import { ItemSchema, type ExtractedItem } from "./types";

const SYSTEM = `You extract physical products a person bought from receipts and order emails.
Return {"items": [...]} where each item has:
name (short product name), brand, model (model number, SKU or size if present),
category (e.g. "baby gear", "appliance", "vehicle part", "food", "electronics"),
purchaseDate (YYYY-MM-DD if known), retailer.
Use null for unknown fields. Skip shipping, fees, gift cards, discounts and digital goods.`;

export async function extractItems(text: string): Promise<ExtractedItem[]> {
  const { items } = await chatJson({
    model: FAST_MODEL,
    system: SYSTEM,
    user: text.slice(0, 12000),
    schema: z.object({ items: z.array(ItemSchema) }),
  });
  return items;
}
