"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useSyncExternalStore, useTransition } from "react";
import { Check, Copy, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { rotateShareToken, setVisibility } from "@/lib/social/actions";

type Visibility = "PRIVATE" | "LINK" | "PUBLIC";

const OPTIONS: { value: Visibility; label: string; hint: string }[] = [
  { value: "PRIVATE", label: "Private", hint: "Only you. Nobody can follow you or borrow from you." },
  { value: "LINK", label: "Anyone with the link", hint: "People who have your link can view and follow you." },
  { value: "PUBLIC", label: "Public", hint: "Anyone can view your collection if they have the link." },
];

export function SharingSettings({ token, visibility }: { token: string; visibility: Visibility }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic(visibility);
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const [copied, setCopied] = useState(false);

  const path = `/share/${token}`;
  const url = `${origin}${path}`;
  const shareable = current !== "PRIVATE";

  function changeVisibility(next: Visibility) {
    startTransition(async () => {
      setCurrent(next);
      const res = await setVisibility(next);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success("Sharing updated.");
        router.refresh();
      }
    });
  }

  function rotate() {
    if (!window.confirm("Rotate your link? The old link will stop working for everyone, including current followers' bookmarks.")) {
      return;
    }
    startTransition(async () => {
      const res = await rotateShareToken();
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("New link generated. The old one no longer works.");
        router.refresh();
      }
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Select the link and copy it manually.");
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Who can see your collection</h2>
        <div role="radiogroup" aria-label="Collection visibility" className="grid gap-2 sm:grid-cols-3">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={current === o.value}
              disabled={pending}
              onClick={() => current !== o.value && changeVisibility(o.value)}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition-colors disabled:opacity-60",
                current === o.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent",
              )}
            >
              <div className="font-medium">{o.label}</div>
              <div className="mt-1 text-muted-foreground">{o.hint}</div>
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          People who follow you can see the cards and quantities in your collection, and the borrow suggestions on
          their Borrow page use it to show what you could lend. Only card codes, variants and counts are shared.
          Setting this to Private hides your collection from followers right away.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Your share link</h2>
        <div className="flex gap-2">
          <Input readOnly value={url} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
          <Button type="button" variant="outline" onClick={copy} disabled={!origin}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        {!shareable && (
          <p className="text-sm text-muted-foreground">
            Your collection is private, so this link shows nothing until you change the setting above.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={rotate} disabled={pending}>
            <RefreshCw /> Rotate link
          </Button>
          {shareable && (
            <Button asChild variant="outline">
              <a href={`/api/share/${token}/json`} download>
                <Download /> Download JSON
              </a>
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Rotating creates a new link and invalidates the old one. People already following you keep following you.
        </p>
      </section>
    </div>
  );
}
