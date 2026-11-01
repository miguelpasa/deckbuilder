"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { importCollection, previewImport } from "@/lib/collection/actions";
import type { ImportPreview } from "@/lib/collection/types";

export function ImportJson() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [pending, start] = useTransition();

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 200_000) {
      setError("File is too large (200 KB max).");
      return;
    }
    setText(await file.text());
    setPreview(null);
    setError(null);
  }

  function runPreview() {
    setError(null);
    start(async () => {
      const r = await previewImport(text);
      if (r.ok) setPreview(r.preview);
      else {
        setPreview(null);
        setError(r.error);
      }
    });
  }

  function apply() {
    if (mode === "replace" && !window.confirm("Replace your whole collection with this file? This cannot be undone.")) {
      return;
    }
    start(async () => {
      const r = await importCollection(text, mode);
      if (r.ok) {
        toast.success(`Imported ${r.preview.resolvedQty} copies (${mode})`);
        setText("");
        setPreview(null);
      } else setError(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="json-file" className="mb-1 block text-sm font-medium">
          Upload a riftbound-collection.json file
        </label>
        <input
          id="json-file"
          type="file"
          accept="application/json,.json"
          className="block text-sm"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </div>
      <div>
        <label htmlFor="json-text" className="mb-1 block text-sm font-medium">
          Or paste JSON
        </label>
        <Textarea
          id="json-text"
          rows={8}
          className="font-mono"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview(null);
            setError(null);
          }}
        />
      </div>
      <Button onClick={runPreview} disabled={pending || !text.trim()}>
        Preview
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {preview && (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm">
            <strong>{preview.resolvedQty}</strong> copies across <strong>{preview.resolvedCount}</strong> printings
            can be imported (from {preview.totalLines} lines).
          </p>
          {preview.unknownCodes.length > 0 && (
            <div className="text-sm text-destructive">
              Unknown card codes (skipped): {preview.unknownCodes.join(", ")}
            </div>
          )}
          {preview.missingPrintings.length > 0 && (
            <div className="text-sm text-destructive">
              Missing printings (skipped):{" "}
              {preview.missingPrintings.map((m) => `${m.code} ${m.variant}`).join(", ")}
            </div>
          )}
          <fieldset className="space-y-1">
            <legend className="mb-1 text-sm font-medium">How to apply</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="mode" checked={mode === "merge"} onChange={() => setMode("merge")} />
              Merge (add quantities to my collection)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="mode" checked={mode === "replace"} onChange={() => setMode("replace")} />
              Replace my collection
            </label>
          </fieldset>
          <Button
            onClick={apply}
            disabled={pending || preview.resolvedCount === 0}
            variant={mode === "replace" ? "destructive" : "default"}
          >
            {pending ? "Importing…" : mode === "replace" ? "Replace collection" : "Merge into collection"}
          </Button>
        </div>
      )}
    </div>
  );
}
