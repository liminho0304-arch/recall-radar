"use client";

import { useEffect, useState } from "react";
import type { Alert, ExtractedItem, Item, ScanResult, Verdict } from "@/lib/types";

const STORAGE_KEY = "recall-radar:v1";

type Stored = { items: Item[]; scans: Record<string, ScanResult> };

function load(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Stored;
  } catch {}
  return { items: [], scans: {} };
}

function save(data: Stored) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

const VERDICT_STYLE: Record<Verdict, { label: string; className: string }> = {
  affects_you: { label: "Affects you", className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
  possibly: { label: "Possibly", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  not_a_match: { label: "Not a match", className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" },
};

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

export default function RecallRadar() {
  const [data, setData] = useState<Stored>({ items: [], scans: {} });
  const [text, setText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [scanning, setScanning] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // localStorage only exists in the browser, so hydrate after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setData(load()), []);

  function update(next: Stored) {
    setData(next);
    save(next);
  }

  async function addFromText() {
    setError(null);
    setExtracting(true);
    try {
      const { items } = await post<{ items: ExtractedItem[] }>("/api/extract", { text });
      const added = items.map((i) => ({ ...i, id: crypto.randomUUID() }));
      update({ ...data, items: [...added, ...data.items] });
      setText("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExtracting(false);
    }
  }

  function remove(id: string) {
    const scans = { ...data.scans };
    delete scans[id];
    update({ items: data.items.filter((i) => i.id !== id), scans });
  }

  async function scan(items: Item[]) {
    setError(null);
    setScanning(new Set(items.map((i) => i.id)));
    const results = await Promise.allSettled(
      items.map((item) => post<ScanResult>("/api/scan", { item })),
    );
    const scans = { ...data.scans };
    for (const r of results) {
      if (r.status === "fulfilled") scans[r.value.itemId] = r.value;
      else setError(r.reason.message);
    }
    update({ ...data, scans });
    setScanning(new Set());
  }

  const flagged = data.items.filter((i) =>
    data.scans[i.id]?.alerts.some((a) => a.verdict !== "not_a_match"),
  ).length;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Recall Radar</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Paste a receipt or order email. Recall Radar checks official recall notices and tells you
          if anything you own is affected.
        </p>
      </header>

      <section className="mb-10 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <label htmlFor="receipt" className="text-sm font-medium">
          Receipt or order email
        </label>
        <textarea
          id="receipt"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Order #123... Graco 4Ever DLX 4-in-1 Car Seat, Model 2074608, $299.99, ordered March 3, 2024"
          className="mt-2 w-full rounded-lg border border-zinc-300 bg-transparent p-3 text-sm dark:border-zinc-700"
        />
        <button
          onClick={addFromText}
          disabled={extracting || !text.trim()}
          className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {extracting ? "Reading..." : "Add items"}
        </button>
      </section>

      {error && (
        <p className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">
            Your items{" "}
            <span className="text-sm font-normal text-zinc-500">
              {data.items.length} tracked{flagged > 0 && `, ${flagged} flagged`}
            </span>
          </h2>
          {data.items.length > 0 && (
            <button
              onClick={() => scan(data.items)}
              disabled={scanning.size > 0}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:opacity-40 dark:border-zinc-700"
            >
              {scanning.size > 0 ? "Scanning..." : "Scan all"}
            </button>
          )}
        </div>

        {data.items.length === 0 ? (
          <p className="text-sm text-zinc-500">No items yet. Add a receipt above to get started.</p>
        ) : (
          <ul className="space-y-3">
            {data.items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                scan={data.scans[item.id]}
                scanning={scanning.has(item.id)}
                onScan={() => scan([item])}
                onRemove={() => remove(item.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function ItemCard(props: {
  item: Item;
  scan?: ScanResult;
  scanning: boolean;
  onScan: () => void;
  onRemove: () => void;
}) {
  const { item, scan } = props;
  const relevant = scan?.alerts.filter((a) => a.verdict !== "not_a_match") ?? [];
  const details = [item.brand, item.model, item.purchaseDate, item.retailer].filter(Boolean);

  return (
    <li className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">{item.name}</p>
          {details.length > 0 && <p className="text-sm text-zinc-500">{details.join(" · ")}</p>}
        </div>
        <div className="flex shrink-0 gap-2 text-sm">
          <button onClick={props.onScan} disabled={props.scanning} className="underline disabled:opacity-40">
            {props.scanning ? "Scanning..." : "Scan"}
          </button>
          <button onClick={props.onRemove} className="text-zinc-500 underline">
            Remove
          </button>
        </div>
      </div>

      {scan && (
        <div className="mt-3 space-y-2">
          {relevant.length === 0 ? (
            <p className="text-sm text-green-700 dark:text-green-400">
              No matching recalls in {scan.sourcesChecked} official notices checked.
            </p>
          ) : (
            relevant.map((a) => <AlertRow key={a.url} alert={a} />)
          )}
        </div>
      )}
    </li>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const style = VERDICT_STYLE[alert.verdict];
  return (
    <div className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}>{style.label}</span>
        {alert.hazard && <span className="text-zinc-600 dark:text-zinc-400">{alert.hazard}</span>}
      </div>
      <p className="mt-2">{alert.reasoning}</p>
      {alert.remedy && (
        <p className="mt-1">
          <span className="font-medium">What to do:</span> {alert.remedy}
        </p>
      )}
      <a href={alert.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-zinc-500 underline">
        {alert.title}
      </a>
    </div>
  );
}
