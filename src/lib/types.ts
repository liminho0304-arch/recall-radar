import { z } from "zod";

export const ItemSchema = z.object({
  name: z.string(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  category: z.string().nullable(),
  purchaseDate: z.string().nullable(),
  retailer: z.string().nullable(),
});

export type ExtractedItem = z.infer<typeof ItemSchema>;

export type Item = ExtractedItem & { id: string };

export const Verdict = z.enum(["affects_you", "possibly", "not_a_match"]);

export type Verdict = z.infer<typeof Verdict>;

export const JudgementSchema = z.object({
  index: z.number().int(),
  verdict: Verdict,
  reasoning: z.string(),
  remedy: z.string().nullable(),
  hazard: z.string().nullable(),
});

export type Judgement = z.infer<typeof JudgementSchema>;

export type Alert = {
  verdict: Verdict;
  title: string;
  url: string;
  reasoning: string;
  remedy: string | null;
  hazard: string | null;
};

export type ScanResult = {
  itemId: string;
  scannedAt: string;
  alerts: Alert[];
  sourcesChecked: number;
};
