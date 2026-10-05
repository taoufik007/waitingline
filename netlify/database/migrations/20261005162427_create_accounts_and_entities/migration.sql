CREATE TABLE "accounts" (
	"email" text PRIMARY KEY,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" text PRIMARY KEY,
	"type" text NOT NULL,
	"owner_email" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"token" text PRIMARY KEY,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_otps" (
	"email" text PRIMARY KEY,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "entities_owner_type_idx" ON "entities" ("owner_email","type");