"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { importDeckAction } from "@/lib/decks/actions";

export function ImportDeckForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ deckId: string; unknownCodes: string[]; imported: number } | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 500_000) {
      setError("File is too large.");
      return;
    }
    setText(await file.text());
  }

  function submit() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await importDeckAction(text);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.unknownCodes.length === 0) {
        toast.success("Deck imported");
        router.push(`/decks/${res.deckId}`);
      } else {
        setResult(res);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="import-file">Upload a riftbound-deck JSON file</Label>
        <Input id="import-file" type="file" accept="application/json,.json" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="import-text">...or paste JSON</Label>
        <Textarea
          id="import-text"
          rows={8}
          className="font-mono text-xs"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <Button onClick={submit} disabled={pending || !text.trim()}>
        {pending ? "Importing…" : "Import deck"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && (
        <div className="rounded-lg border p-3 text-sm">
          <p>
            Imported {result.imported} card line(s), but {result.unknownCodes.length} code(s) are not in the card
            database and were left out:
          </p>
          <p className="mt-1 break-words font-mono text-xs">{result.unknownCodes.join(", ")}</p>
          <Button asChild size="sm" className="mt-3">
            <Link href={`/decks/${result.deckId}`}>Open the imported deck</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
