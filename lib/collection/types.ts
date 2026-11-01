export type Variant = "NORMAL" | "FOIL" | "ALT_ART";

export const VARIANT_LABEL: Record<Variant, string> = {
  NORMAL: "Normal",
  FOIL: "Foil",
  ALT_ART: "Alt art",
};

export type CollectionRow = {
  printingId: number;
  variant: Variant;
  quantity: number;
  cardId: string;
  code: string | null;
  name: string;
  type: string | null;
  faction: string | null;
  rarity: string | null;
  setId: string;
  setName: string;
  thumbnailUrl: string | null;
  isPlaceholder: boolean;
};

export type PreviewRow = {
  lineNo: number;
  raw: string;
  status: "ok" | "error";
  qty: number;
  variant: Variant;
  message?: string;
  warning?: string;
  printingId?: number;
  cardName?: string;
  code?: string | null;
};

export type ImportPreview = {
  totalLines: number;
  resolvedCount: number;
  resolvedQty: number;
  unknownCodes: string[];
  missingPrintings: { code: string; variant: Variant }[];
};

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };
