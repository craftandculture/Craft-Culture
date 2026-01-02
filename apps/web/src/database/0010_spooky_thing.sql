ALTER TABLE "private_client_contacts" ADD COLUMN "city_drinks_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "private_client_contacts" ADD COLUMN "city_drinks_verified_by" uuid;--> statement-breakpoint
ALTER TABLE "private_client_contacts" ADD COLUMN "city_drinks_account_name" text;--> statement-breakpoint
ALTER TABLE "private_client_contacts" ADD COLUMN "city_drinks_phone" text;--> statement-breakpoint
ALTER TABLE "private_client_contacts" ADD CONSTRAINT "private_client_contacts_city_drinks_verified_by_users_id_fk" FOREIGN KEY ("city_drinks_verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;