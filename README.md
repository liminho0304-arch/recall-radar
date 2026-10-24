# Recall Radar

Nemotron + Tavily agent that tells you if anything you own was recalled.

Paste a receipt or order email. Recall Radar pulls out the products you bought, searches official recall sources with Tavily, and uses an NVIDIA Nemotron reasoning model to decide whether each notice really covers *your* model and purchase date. Every alert cites its source and says what to do next.

Built for the Nebius x NVIDIA Global AI Hackathon (Best Apps and Agents track).

## How it works

1. **Extract** (`src/lib/extract.ts`): a fast Nemotron model turns receipt text into structured items (brand, model, purchase date, retailer).
2. **Search** (`src/lib/recalls.ts`): Tavily searches only official US recall sources (CPSC, SaferProducts, NHTSA, FDA, USDA FSIS, Recalls.gov).
3. **Match** (`src/lib/recalls.ts`): a Nemotron reasoning model compares each notice to the owned item and returns *Affects you*, *Possibly* or *Not a match*, with its reasoning, the hazard and the remedy.

All model calls go through Nebius Token Factory's OpenAI-compatible API (`src/lib/llm.ts`).

## Run locally

Requires Node 20+.

```bash
npm install
cp .env.example .env.local   # then fill in the keys and model IDs
npm run dev
```

Open http://localhost:3000.

| Variable | What it is |
|---|---|
| `LLM_BASE_URL` | `https://api.tokenfactory.nebius.com/v1/` |
| `LLM_API_KEY` | Nebius Token Factory API key |
| `FAST_MODEL` | Nemotron model ID for extraction |
| `REASONING_MODEL` | Nemotron model ID for recall matching |
| `TAVILY_API_KEY` | Tavily API key |

Your item list is stored in your browser (localStorage).

## License

MIT
