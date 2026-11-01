"use client";

import { useState } from "react";

import { QuantityStepper } from "@/components/collection/quantity-stepper";
import { VARIANT_LABEL, type Variant } from "@/lib/collection/types";

type P = { printingId: number; variant: Variant; quantity: number };

export function OwnedControls({ cardName, printings }: { cardName: string; printings: P[] }) {
  const [qty, setQty] = useState(() => Object.fromEntries(printings.map((p) => [p.printingId, p.quantity])));
  return (
    <ul className="divide-y rounded-lg border">
      {printings.map((p) => (
        <li key={p.printingId} className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="text-sm font-medium">{VARIANT_LABEL[p.variant]}</span>
          <QuantityStepper
            printingId={p.printingId}
            quantity={qty[p.printingId] ?? 0}
            label={`${cardName} (${VARIANT_LABEL[p.variant]})`}
            onChange={(n) => setQty((s) => ({ ...s, [p.printingId]: n }))}
          />
        </li>
      ))}
    </ul>
  );
}
