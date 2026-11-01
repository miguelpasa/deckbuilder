CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."deck_source" AS ENUM('META', 'USER');--> statement-breakpoint
CREATE TYPE "public"."deck_zone" AS ENUM('LEGEND', 'CHAMPION', 'MAIN', 'RUNE', 'BATTLEFIELD', 'SIDEBOARD');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('USER', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."card_variant" AS ENUM('NORMAL', 'FOIL', 'ALT_ART');--> statement-breakpoint
CREATE TYPE "public"."collection_visibility" AS ENUM('PRIVATE', 'LINK', 'PUBLIC');--> statement-breakpoint
CREATE TABLE "cards" (
	"id" text PRIMARY KEY NOT NULL,
	"set_id" text NOT NULL,
	"collector_number" integer,
	"public_code" text,
	"name" text NOT NULL,
	"subtitle" text,
	"type" text,
	"rarity" text,
	"faction" text,
	"description" text,
	"effect" text,
	"flavor_text" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"energy" integer,
	"might" integer,
	"cost" integer,
	"power" integer,
	"thumbnail_url" text,
	"full_url" text,
	"artist" text,
	"is_placeholder" boolean DEFAULT false NOT NULL,
	"raw" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cards_public_code_unique" UNIQUE("public_code")
);
--> statement-breakpoint
CREATE TABLE "collection_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"printing_id" integer NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_user_printing_uq" UNIQUE("user_id","printing_id"),
	CONSTRAINT "collection_quantity_nonneg" CHECK ("collection_entries"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "deck_cards" (
	"deck_id" uuid NOT NULL,
	"card_id" text NOT NULL,
	"zone" "deck_zone" NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "deck_cards_deck_id_card_id_zone_pk" PRIMARY KEY("deck_id","card_id","zone"),
	CONSTRAINT "deck_cards_quantity_positive" CHECK ("deck_cards"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text,
	"name" text NOT NULL,
	"description" text,
	"legend_card_id" text,
	"source" "deck_source" DEFAULT 'USER' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"event_name" text,
	"placement" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"follower_id" text NOT NULL,
	"followee_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_follower_id_followee_id_pk" PRIMARY KEY("follower_id","followee_id"),
	CONSTRAINT "follows_not_self" CHECK ("follows"."follower_id" <> "follows"."followee_id")
);
--> statement-breakpoint
CREATE TABLE "imported_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"label" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imported_entries" (
	"imported_collection_id" uuid NOT NULL,
	"card_id" text NOT NULL,
	"variant" "card_variant" DEFAULT 'NORMAL' NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "imported_entries_imported_collection_id_card_id_variant_pk" PRIMARY KEY("imported_collection_id","card_id","variant"),
	CONSTRAINT "imported_entries_quantity_nonneg" CHECK ("imported_entries"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "printings" (
	"id" serial PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"variant" "card_variant" NOT NULL,
	CONSTRAINT "printings_card_variant_uq" UNIQUE("card_id","variant")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"display_name" text,
	"share_token" text,
	"collection_visibility" "collection_visibility" DEFAULT 'PRIVATE' NOT NULL,
	"role" "user_role" DEFAULT 'USER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "sets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"raw" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"card_count" integer,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_set_id_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_entries" ADD CONSTRAINT "collection_entries_printing_id_printings_id_fk" FOREIGN KEY ("printing_id") REFERENCES "public"."printings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_legend_card_id_cards_id_fk" FOREIGN KEY ("legend_card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imported_entries" ADD CONSTRAINT "imported_entries_imported_collection_id_imported_collections_id_fk" FOREIGN KEY ("imported_collection_id") REFERENCES "public"."imported_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imported_entries" ADD CONSTRAINT "imported_entries_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printings" ADD CONSTRAINT "printings_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_set_idx" ON "cards" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "cards_type_idx" ON "cards" USING btree ("type");--> statement-breakpoint
CREATE INDEX "cards_faction_idx" ON "cards" USING btree ("faction");--> statement-breakpoint
CREATE INDEX "cards_name_trgm_idx" ON "cards" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "collection_user_idx" ON "collection_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "deck_cards_card_idx" ON "deck_cards" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "decks_owner_idx" ON "decks" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "decks_source_featured_idx" ON "decks" USING btree ("source","is_featured");--> statement-breakpoint
CREATE INDEX "follows_followee_idx" ON "follows" USING btree ("followee_id");--> statement-breakpoint
CREATE INDEX "imported_collections_owner_idx" ON "imported_collections" USING btree ("owner_id");