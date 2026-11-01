"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { follow, unfollow } from "@/lib/social/actions";

export function AddFriendForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    startTransition(async () => {
      const res = await follow(value);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(`Now following ${res.name}.`);
        setValue("");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Paste a share link or token"
        aria-label="Friend's share link or token"
        autoComplete="off"
      />
      <Button type="submit" disabled={pending || !value.trim()}>
        <UserPlus /> Follow
      </Button>
    </form>
  );
}

export function UnfollowButton({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await unfollow(userId);
          if (!res.ok) toast.error(res.error);
          else {
            toast.success(`Unfollowed ${name}.`);
            router.refresh();
          }
        })
      }
    >
      <UserMinus /> Unfollow
    </Button>
  );
}
