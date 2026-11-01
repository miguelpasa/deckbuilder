"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  importMetaDeckAction,
  syncCatalogAction,
  type SyncActionResult,
} from "@/lib/decks/actions";
import type { UpsertSystemResult } from "@/lib/decks/service";

export function ImportMetaDeckForm() {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UpsertSystemResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await importMetaDeckAction(text);
      if (res.ok) setResult(res.result);
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <Label htmlFor="meta-json">Meta deck JSON (riftbound-deck v1)</Label>
      <Textarea
        id="meta-json"
        rows={8}
        className="font-mono text-xs"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button onClick={submit} disabled={pending || !text.trim()}>
        {pending ? "Importing…" : "Import meta deck"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {result?.status === "skipped" && (
        <p role="alert" className="text-sm text-destructive">
          Skipped &quot;{result.name}&quot;: {result.missingCodes.length} unknown card code(s):{" "}
          <span className="font-mono text-xs">{result.missingCodes.join(", ")}</span>
        </p>
      )}
      {result && result.status !== "skipped" && (
        <p className="text-sm">
          Deck &quot;{result.name}&quot; {result.status} ({result.cards} card lines).
        </p>
      )}
    </div>
  );
}

export function SyncButton() {
  const [result, setResult] = useState<SyncActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <Button
        onClick={() =>
          startTransition(async () => {
            setResult(await syncCatalogAction());
          })
        }
        disabled={pending}
      >
        {pending ? "Syncing…" : "Sync Riot catalog now"}
      </Button>
      {result?.ok === true && (
        <p className="text-sm">
          Sync OK: {result.summary.sets} set(s), {result.summary.cards} card(s), {result.summary.printings} printing(s).
        </p>
      )}
      {result?.ok === false && (
        <div role="alert" className="rounded-xl border border-destructive/50 p-3 text-sm">
          <p className="font-medium text-destructive">
            {result.errorName}
            {result.status ? ` (HTTP ${result.status})` : ""}
          </p>
          <p className="mt-1 text-muted-foreground">{result.message}</p>
        </div>
      )}
    </div>
  );
}
