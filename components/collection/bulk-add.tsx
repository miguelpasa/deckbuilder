"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { bulkAdd, previewBulk } from "@/lib/collection/actions";
import { VARIANT_LABEL, type PreviewRow } from "@/lib/collection/types";

const EXAMPLE = "3 OGN-042\n2x Some Card Name foil\nOGN-007 x4 alt";

export function BulkAdd() {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [pending, start] = useTransition();

  const ok = rows?.filter((r) => r.status === "ok") ?? [];
  const errors = rows?.filter((r) => r.status === "error") ?? [];

  function preview() {
    start(async () => {
      const r = await previewBulk(text);
      if (r.ok) {
        setRows(r.rows);
        setTruncated(r.truncated);
      } else toast.error(r.error);
    });
  }

  function apply() {
    start(async () => {
      const r = await bulkAdd(ok.map((x) => ({ printingId: x.printingId!, qty: x.qty })));
      if (r.ok) {
        toast.success(`Added ${r.copies} copies across ${r.lines} printings`);
        setText("");
        setRows(null);
      } else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="bulk-text" className="mb-1 block text-sm font-medium">
          One card per line
        </label>
        <Textarea
          id="bulk-text"
          rows={8}
          placeholder={EXAMPLE}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setRows(null);
          }}
          className="font-mono"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Formats: <code>3 OGN-042</code>, <code>OGN-042 x3</code>, <code>2 Card Name</code>. Add{" "}
          <code>foil</code> or <code>alt</code> at the end for other printings. Lines starting with # are ignored.
        </p>
      </div>
      <Button onClick={preview} disabled={pending || !text.trim()}>
        {pending && !rows ? "Checking…" : "Preview"}
      </Button>

      {rows && (
        <div className="space-y-3">
          <p className="text-sm">
            <strong>{ok.length}</strong> ready to add
            {errors.length > 0 && (
              <>
                , <strong className="text-destructive">{errors.length}</strong> with problems (these are skipped)
              </>
            )}
            .
          </p>
          {truncated && (
            <p className="text-sm text-destructive">Only the first 500 lines were checked; split the rest.</p>
          )}
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No card lines found.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Line</TableHead>
                    <TableHead>Input</TableHead>
                    <TableHead>Card</TableHead>
                    <TableHead>Printing</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.lineNo} className={r.status === "error" ? "bg-destructive/5" : undefined}>
                      <TableCell className="tabular-nums">{r.lineNo}</TableCell>
                      <TableCell className="font-mono text-xs">{r.raw.trim()}</TableCell>
                      <TableCell>
                        {r.cardName ? (
                          <>
                            {r.cardName} <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
                          </>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{r.status === "ok" || r.cardName ? VARIANT_LABEL[r.variant] : "-"}</TableCell>
                      <TableCell className="tabular-nums">{r.qty || "-"}</TableCell>
                      <TableCell className="whitespace-normal">
                        {r.status === "error" ? (
                          <span className="text-sm text-destructive">{r.message}</span>
                        ) : r.warning ? (
                          <span className="text-sm text-warning">{r.warning}</span>
                        ) : (
                          <Badge variant="success">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <Button onClick={apply} disabled={pending || ok.length === 0}>
            {pending ? "Adding…" : `Add ${ok.reduce((s, r) => s + r.qty, 0)} cards`}
          </Button>
        </div>
      )}
    </div>
  );
}
