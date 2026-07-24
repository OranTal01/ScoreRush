ALTER TABLE "notifications" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "recipient_email" text NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "provider_message_id" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "error_detail" text;