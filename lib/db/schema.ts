import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// NOTE: user ids are Neon Auth ids (text). There is deliberately no FK to the
// neon_auth schema; we only ever reference them as plain text.

export const visibilityEnum = pgEnum("collection_visibility", [
  "PRIVATE",
  "LINK",
  "PUBLIC",
]);
export const roleEnum = pgEnum("user_role", ["USER", "ADMIN"]);
export const variantEnum = pgEnum("card_variant", ["NORMAL", "FOIL", "ALT_ART"]);
export const deckSourceEnum = pgEnum("deck_source", ["META", "USER"]);
export const deckZoneEnum = pgEnum("deck_zone", [
  "LEGEND",
  "CHAMPION",
  "MAIN",
  "RUNE",
  "BATTLEFIELD",
  "SIDEBOARD",
]);

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const profiles = pgTable("profiles", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name"),
  shareToken: text("share_token").unique(),
  collectionVisibility: visibilityEnum("collection_visibility")
    .notNull()
    .default("PRIVATE"),
  role: roleEnum("role").notNull().default("USER"),
  createdAt: createdAt(),
});

export const sets = pgTable("sets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  raw: jsonb("raw"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const cards = pgTable(
  "cards",
  {
    id: text("id").primaryKey(),
    setId: text("set_id")
      .notNull()
      .references(() => sets.id),
    collectorNumber: integer("collector_number"),
    publicCode: text("public_code").unique(),
    name: text("name").notNull(),
    subtitle: text("subtitle"),
    type: text("type"),
    rarity: text("rarity"),
    faction: text("faction"),
    description: text("description"),
    effect: text("effect"),
    flavorText: text("flavor_text"),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    energy: integer("energy"),
    might: integer("might"),
    cost: integer("cost"),
    power: integer("power"),
    thumbnailUrl: text("thumbnail_url"),
    fullUrl: text("full_url"),
    artist: text("artist"),
    isPlaceholder: boolean("is_placeholder").notNull().default(false),
    raw: jsonb("raw"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("cards_set_idx").on(t.setId),
    index("cards_type_idx").on(t.type),
    index("cards_faction_idx").on(t.faction),
    index("cards_name_trgm_idx").using("gin", t.name.op("gin_trgm_ops")),
  ],
);

export const printings = pgTable(
  "printings",
  {
    id: serial("id").primaryKey(),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id),
    variant: variantEnum("variant").notNull(),
  },
  (t) => [unique("printings_card_variant_uq").on(t.cardId, t.variant)],
);

export const collectionEntries = pgTable(
  "collection_entries",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    printingId: integer("printing_id")
      .notNull()
      .references(() => printings.id),
    quantity: integer("quantity").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("collection_user_printing_uq").on(t.userId, t.printingId),
    check("collection_quantity_nonneg", sql`${t.quantity} >= 0`),
    index("collection_user_idx").on(t.userId),
  ],
);

export const decks = pgTable(
  "decks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id"),
    name: text("name").notNull(),
    description: text("description"),
    legendCardId: text("legend_card_id").references(() => cards.id),
    source: deckSourceEnum("source").notNull().default("USER"),
    isFeatured: boolean("is_featured").notNull().default(false),
    isPublic: boolean("is_public").notNull().default(false),
    eventName: text("event_name"),
    placement: text("placement"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("decks_owner_idx").on(t.ownerId),
    index("decks_source_featured_idx").on(t.source, t.isFeatured),
  ],
);

export const deckCards = pgTable(
  "deck_cards",
  {
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id),
    zone: deckZoneEnum("zone").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.deckId, t.cardId, t.zone] }),
    check("deck_cards_quantity_positive", sql`${t.quantity} > 0`),
    index("deck_cards_card_idx").on(t.cardId),
  ],
);

export const follows = pgTable(
  "follows",
  {
    followerId: text("follower_id").notNull(),
    followeeId: text("followee_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followeeId] }),
    index("follows_followee_idx").on(t.followeeId),
    check("follows_not_self", sql`${t.followerId} <> ${t.followeeId}`),
  ],
);

export const importedCollections = pgTable(
  "imported_collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").notNull(),
    label: text("label").notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("imported_collections_owner_idx").on(t.ownerId)],
);

export const importedEntries = pgTable(
  "imported_entries",
  {
    importedCollectionId: uuid("imported_collection_id")
      .notNull()
      .references(() => importedCollections.id, { onDelete: "cascade" }),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id),
    variant: variantEnum("variant").notNull().default("NORMAL"),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.importedCollectionId, t.cardId, t.variant] }),
    check("imported_entries_quantity_nonneg", sql`${t.quantity} >= 0`),
  ],
);

export const syncRuns = pgTable("sync_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull().default("running"),
  cardCount: integer("card_count"),
  error: text("error"),
});

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type Printing = typeof printings.$inferSelect;
