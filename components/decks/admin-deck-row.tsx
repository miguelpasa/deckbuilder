"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { setDeckFlagsAction } from "@/lib/decks/actions";

export function AdminDeckRow({
  deck,
}: {
  deck: { id: string; name: string; isPublic: boolean; isFeatured: boolean; source: "META" | "USER"; system: boolean };
}) {
  const [pending, startTransition] = useTransition();

  function update(flags: { isFeatured?: boolean; source?: "META" | "USER" }) {
    startTransition(async () => {
      const res = await setDeckFlagsAction(deck.id, flags);
      if (!res.ok) toast.error(res.error);
      else toast.success("Updated");
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-4 p-3 text-sm">
      <Link href={`/decks/${deck.id}`} className="min-w-0 flex-1 font-medium transition-colors hover:underline">
        {deck.name}
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {deck.system ? "system" : "user"} · {deck.isPublic ? "public" : "private"}
        </span>
      </Link>
      <label className="flex items-center gap-2">
        <Switch checked={deck.isFeatured} disabled={pending} onCheckedChange={(v) => update({ isFeatured: v })} />
        Featured
      </label>
      <label className="flex items-center gap-2">
        <Switch
          checked={deck.source === "META"}
          disabled={pending}
          onCheckedChange={(v) => update({ source: v ? "META" : "USER" })}
        />
        Meta source
      </label>
    </li>
  );
}
