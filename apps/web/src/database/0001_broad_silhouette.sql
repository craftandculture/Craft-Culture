CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');

--> statement-breakpoint
CREATE TABLE "sheets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text DEFAULT gen_random_uuid()::text NOT NULL,
  "google_sheet_id" text NOT NULL,
  "formula_data" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "sheets_google_sheet_id_unique" UNIQUE ("google_sheet_id")
);

--> statement-breakpoint
ALTER TABLE "sheets" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "pricing_models"
DROP CONSTRAINT "pricing_models_google_sheet_id_unique";

--> statement-breakpoint
ALTER TABLE "pricing_models"
DROP CONSTRAINT "pricing_models_google_sheet_id_sheet_index_unique";

--> statement-breakpoint
ALTER TABLE "pricing_models"
ADD COLUMN "name" text NOT NULL;

--> statement-breakpoint
ALTER TABLE "pricing_models"
ADD COLUMN "is_default_b2c" boolean DEFAULT false NOT NULL;

--> statement-breakpoint
ALTER TABLE "pricing_models"
ADD COLUMN "is_default_b2b" boolean DEFAULT false NOT NULL;

--> statement-breakpoint
ALTER TABLE "pricing_models"
ADD COLUMN "sheet_id" uuid NOT NULL;

--> statement-breakpoint
ALTER TABLE "pricing_models"
ADD COLUMN "cell_mappings" jsonb NOT NULL;

--> statement-breakpoint
ALTER TABLE "users"
ADD COLUMN "role" "user_role" DEFAULT 'user' NOT NULL;

--> statement-breakpoint
ALTER TABLE "pricing_models"
ADD CONSTRAINT "pricing_models_sheet_id_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."sheets" ("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
CREATE INDEX "unique_default_b2c" ON "pricing_models" USING btree ("is_default_b2c")
WHERE
  "pricing_models"."is_default_b2c" = true;

--> statement-breakpoint
CREATE INDEX "unique_default_b2b" ON "pricing_models" USING btree ("is_default_b2b")
WHERE
  "pricing_models"."is_default_b2b" = true;

--> statement-breakpoint
ALTER TABLE "pricing_models"
DROP COLUMN "is_public";

--> statement-breakpoint
ALTER TABLE "pricing_models"
DROP COLUMN "is_active";

--> statement-breakpoint
ALTER TABLE "pricing_models"
DROP COLUMN "google_sheet_id";

--> statement-breakpoint
ALTER TABLE "pricing_models"
DROP COLUMN "sheet_index";

--> statement-breakpoint
ALTER TABLE "pricing_models"
DROP COLUMN "formula_data";
