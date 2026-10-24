import { judgeRecalls, searchRecalls } from "@/lib/recalls";
import type { Item, ScanResult } from "@/lib/types";

const ORDER = { affects_you: 0, possibly: 1, not_a_match: 2 } as const;

export async function POST(request: Request) {
  const { item } = (await request.json()) as { item?: Item };
  if (!item?.name) {
    return Response.json({ error: "Missing item." }, { status: 400 });
  }
  try {
    const results = await searchRecalls(item);
    const alerts = await judgeRecalls(item, results);
    alerts.sort((a, b) => ORDER[a.verdict] - ORDER[b.verdict]);
    const scan: ScanResult = {
      itemId: item.id,
      scannedAt: new Date().toISOString(),
      alerts,
      sourcesChecked: results.length,
    };
    return Response.json(scan);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
