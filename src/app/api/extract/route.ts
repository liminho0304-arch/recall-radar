import { extractItems } from "@/lib/extract";

export async function POST(request: Request) {
  const { text } = (await request.json()) as { text?: string };
  if (!text?.trim()) {
    return Response.json({ error: "Paste a receipt or order email first." }, { status: 400 });
  }
  try {
    const items = await extractItems(text);
    return Response.json({ items });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
