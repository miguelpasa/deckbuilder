import Image from "next/image";

import { DomainBadge } from "@/components/cards/domain-badge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  type?: string | null;
  faction?: string | null;
  imageUrl?: string | null;
  isPlaceholder?: boolean;
  className?: string;
  priority?: boolean;
};

/** Card art with a text fallback tile when no image URL exists. Aspect ratio 5:7. */
export function CardArt({ name, type, faction, imageUrl, isPlaceholder, className, priority }: Props) {
  return (
    <div
      className={cn(
        "relative aspect-[5/7] w-full overflow-hidden rounded-lg border border-border bg-muted transition-[border-color,box-shadow] duration-150",
        className,
      )}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={name}
          fill
          sizes="(min-width: 1024px) 200px, (min-width: 640px) 25vw, 45vw"
          className="object-cover"
          priority={priority}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-1 p-3 text-center">
          <span className="text-sm font-semibold leading-tight">{name}</span>
          {(type || faction) && (
            <span className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted-foreground">
              {type && <span>{type}</span>}
              <DomainBadge domain={faction} />
            </span>
          )}
        </div>
      )}
      {isPlaceholder && <PlaceholderBadge className="absolute bottom-1 left-1" />}
    </div>
  );
}

export function PlaceholderBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("bg-background/90 text-[10px]", className)}>
      Development placeholder data
    </Badge>
  );
}
