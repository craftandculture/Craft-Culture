CREATE TABLE "user_activity_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "action" text NOT NULL,
  "entity_type" text,
  "entity_id" text,
  "metadata" jsonb,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
ALTER TABLE "user_activity_logs"
ADD CONSTRAINT "user_activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
CREATE INDEX "user_activity_logs_user_id_idx" ON "user_activity_logs" USING btree ("user_id");

--> statement-breakpoint
CREATE INDEX "user_activity_logs_created_at_idx" ON "user_activity_logs" USING btree ("created_at");

--> statement-breakpoint
CREATE INDEX "user_activity_logs_action_idx" ON "user_activity_logs" USING btree ("action");

--> statement-breakpoint
ALTER TABLE "user_activity_logs" ENABLE ROW LEVEL SECURITY;
