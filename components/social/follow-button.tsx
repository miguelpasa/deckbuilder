"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { follow, unfollow } from "@/lib/social/actions";

export function FollowButton({
  token,
  userId,
  following,
}: {
  token: string;
  userId: string;
  following: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const res = following ? await unfollow(userId) : await follow(token);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(following ? "Unfollowed." : "Following.");
        router.refresh();
      }
    });
  }

  return (
    <Button type="button" variant={following ? "outline" : "default"} onClick={toggle} disabled={pending}>
      {following ? <UserMinus /> : <UserPlus />}
      {following ? "Unfollow" : "Follow"}
    </Button>
  );
}
