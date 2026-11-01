"use client";

import { Check, Copy, Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Could not access the clipboard");
  }
}

export function DeckActions({
  deckId,
  deckText,
  missingText,
}: {
  deckId: string;
  deckText: string;
  missingText: string | null;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" size="sm">
        <a href={`/api/decks/${deckId}/export`} download>
          <Download /> Export JSON
        </a>
      </Button>
      <Button variant="outline" size="sm" onClick={() => copy(deckText, "Decklist")}>
        <Copy /> Copy as text
      </Button>
      {missingText !== null && (
        <Button
          variant="outline"
          size="sm"
          disabled={missingText === ""}
          onClick={() => copy(missingText, "Missing list")}
        >
          <Check /> Copy missing list
        </Button>
      )}
    </div>
  );
}
