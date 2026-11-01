"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Pencil, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteImportedCollection,
  previewImportedCollection,
  renameImportedCollection,
  saveImportedCollection,
} from "@/lib/social/actions";
import type { ImportPreview } from "@/lib/social/service";

export type ImportedItem = { id: string; label: string; importedAt: string; cardCount: number };

function PreviewSummary({ preview }: { preview: ImportPreview }) {
  return (
    <div className="rounded-md border bg-muted/40 p-3 text-sm">
      <p>
        {preview.cardCount} cards ({preview.distinctCards} distinct) recognised
        {preview.owner ? ` from ${preview.owner}` : ""}.
      </p>
      {preview.unknownCodes.length > 0 && (
        <p className="mt-1 text-amber-700 dark:text-amber-400">
          {preview.unknownCodes.length} unknown code{preview.unknownCodes.length === 1 ? "" : "s"} will be skipped:{" "}
          {preview.unknownCodes.slice(0, 20).join(", ")}
          {preview.unknownCodes.length > 20 ? ", …" : ""}
        </p>
      )}
    </div>
  );
}

/** Upload/paste a riftbound-collection JSON, preview it, then save (or replace an existing snapshot). */
function ImportForm({
  replaceId,
  initialLabel,
  onDone,
}: {
  replaceId?: string;
  initialLabel?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState(initialLabel ?? "");
  const [json, setJson] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function changeJson(text: string) {
    setJson(text);
    setPreview(null);
    setError(null);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    changeJson(await file.text());
    if (!label && !replaceId) setLabel(file.name.replace(/\.json$/i, ""));
    e.target.value = "";
  }

  function runPreview() {
    startTransition(async () => {
      const res = await previewImportedCollection(json);
      if (!res.ok) {
        setPreview(null);
        setError(res.error);
      } else {
        setError(null);
        setPreview(res.preview);
      }
    });
  }

  function save() {
    startTransition(async () => {
      const res = await saveImportedCollection({ label, json, replaceId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(replaceId ? "Snapshot re-imported." : "Snapshot saved.");
      setJson("");
      setPreview(null);
      setError(null);
      if (!replaceId) setLabel("");
      onDone?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={`Label, e.g. "Alex's binder"`}
        aria-label="Snapshot label"
        maxLength={100}
      />
      <Textarea
        value={json}
        onChange={(e) => changeJson(e.target.value)}
        placeholder="Paste riftbound-collection JSON here"
        aria-label="Collection JSON"
        rows={5}
        className="font-mono text-xs"
      />
      <div className="flex flex-wrap gap-2">
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload /> Upload file
        </Button>
        <Button type="button" variant="outline" onClick={runPreview} disabled={pending || !json.trim()}>
          Preview
        </Button>
        <Button type="button" onClick={save} disabled={pending || !json.trim() || !label.trim()}>
          {replaceId ? "Replace snapshot" : "Save snapshot"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {preview && <PreviewSummary preview={preview} />}
    </div>
  );
}

export function NewImportCard() {
  return <ImportForm />;
}

function ImportedRowItem({ item }: { item: ImportedItem }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [reimporting, setReimporting] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [pending, startTransition] = useTransition();

  function rename() {
    startTransition(async () => {
      const res = await renameImportedCollection(item.id, label);
      if (!res.ok) toast.error(res.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function remove() {
    if (!window.confirm(`Delete "${item.label}"?`)) return;
    startTransition(async () => {
      const res = await deleteImportedCollection(item.id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Snapshot deleted.");
        router.refresh();
      }
    });
  }

  return (
    <li className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              aria-label="Snapshot label"
              className="max-w-xs"
              maxLength={100}
            />
            <Button size="sm" onClick={rename} disabled={pending || !label.trim()}>
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setLabel(item.label);
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{item.label}</div>
              <div className="text-xs text-muted-foreground">
                {item.cardCount} cards · imported {new Date(item.importedAt).toLocaleDateString()}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} disabled={pending}>
              <Pencil /> Rename
            </Button>
            <Button size="sm" variant="outline" onClick={() => setReimporting((v) => !v)} disabled={pending}>
              <RefreshCw /> Re-import
            </Button>
            <Button size="sm" variant="outline" onClick={remove} disabled={pending}>
              <Trash2 /> Delete
            </Button>
          </>
        )}
      </div>
      {reimporting && (
        <ImportForm replaceId={item.id} initialLabel={item.label} onDone={() => setReimporting(false)} />
      )}
    </li>
  );
}

export function ImportedList({ items }: { items: ImportedItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No snapshots yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <ImportedRowItem key={i.id} item={i} />
      ))}
    </ul>
  );
}
