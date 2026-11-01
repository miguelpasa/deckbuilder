"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adjustQuantity, setQuantity } from "@/lib/collection/actions";

type Props = {
  printingId: number;
  quantity: number;
  /** Called optimistically, then again with the server's value (or the previous value on failure). */
  onChange: (next: number) => void;
  label: string;
};

export function QuantityStepper({ printingId, quantity, onChange, label }: Props) {
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<string | null>(null);

  function adjust(delta: number) {
    const prev = quantity;
    const next = Math.max(0, prev + delta);
    if (next === prev) return;
    onChange(next);
    start(async () => {
      const r = await adjustQuantity(printingId, delta);
      if (r.ok) onChange(r.quantity);
      else {
        onChange(prev);
        toast.error(r.error);
      }
    });
  }

  function commit() {
    if (draft === null) return;
    const n = Math.floor(Number(draft));
    setDraft(null);
    if (!Number.isFinite(n) || n < 0 || n === quantity) return;
    const prev = quantity;
    onChange(n);
    start(async () => {
      const r = await setQuantity(printingId, n);
      if (r.ok) onChange(r.quantity);
      else {
        onChange(prev);
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="inline-flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={`Remove one ${label}`}
        disabled={pending || quantity <= 0}
        onClick={() => adjust(-1)}
      >
        <MinusIcon />
      </Button>
      <Input
        inputMode="numeric"
        aria-label={`Quantity of ${label}`}
        className="h-8 w-14 px-1 text-center"
        value={draft ?? String(quantity)}
        disabled={pending}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setDraft(null);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={`Add one ${label}`}
        disabled={pending}
        onClick={() => adjust(1)}
      >
        <PlusIcon />
      </Button>
    </div>
  );
}
