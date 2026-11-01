import { cn } from "@/lib/utils"

type Domain = "fury" | "calm" | "body" | "mind" | "order" | "chaos"

// Static class strings so Tailwind can see every name.
const DOMAIN_STYLES: Record<Domain, { label: string; pill: string; dot: string }> = {
  fury: { label: "Fury", pill: "bg-domain-fury-tint border-domain-fury/40", dot: "bg-domain-fury" },
  calm: { label: "Calm", pill: "bg-domain-calm-tint border-domain-calm/40", dot: "bg-domain-calm" },
  body: { label: "Body", pill: "bg-domain-body-tint border-domain-body/40", dot: "bg-domain-body" },
  mind: { label: "Mind", pill: "bg-domain-mind-tint border-domain-mind/40", dot: "bg-domain-mind" },
  order: { label: "Order", pill: "bg-domain-order-tint border-domain-order/40", dot: "bg-domain-order" },
  chaos: { label: "Chaos", pill: "bg-domain-chaos-tint border-domain-chaos/40", dot: "bg-domain-chaos" },
}

const BASE =
  "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap"

/** Renders one badge per domain. Multi-domain values such as "Fury/Body" split on "/" or ",". */
export function DomainBadge({
  domain,
  className,
}: {
  domain?: string | null
  className?: string
}) {
  const parts = (domain ?? "")
    .split(/[\/,]/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return null
  if (parts.length === 1) return <SingleDomainBadge domain={parts[0]} className={className} />

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {parts.map((p) => (
        <SingleDomainBadge key={p} domain={p} />
      ))}
    </span>
  )
}

function SingleDomainBadge({ domain, className }: { domain: string; className?: string }) {
  const raw = domain

  const style = DOMAIN_STYLES[raw.toLowerCase() as Domain]
  if (!style) {
    return (
      <span className={cn(BASE, "border-border text-foreground", className)}>
        {raw}
      </span>
    )
  }

  // Text stays in the foreground colour; the domain colour only fills the dot
  // and tints the pill, so contrast does not depend on the domain hue.
  return (
    <span className={cn(BASE, "text-foreground", style.pill, className)}>
      <span aria-hidden="true" className={cn("size-2 rounded-full", style.dot)} />
      {style.label}
    </span>
  )
}
