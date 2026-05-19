-- Migration 0001: schema updates from user stories review
-- Apply in Supabase SQL editor

-- 1. New enum for plan types
CREATE TYPE "public"."plan_type" AS ENUM('credits', 'unlimited');

-- 2. Add optional info columns to gyms
ALTER TABLE "gyms" ADD COLUMN "address" text;
ALTER TABLE "gyms" ADD COLUMN "phone" text;
ALTER TABLE "gyms" ADD COLUMN "email" text;
ALTER TABLE "gyms" ADD COLUMN "opening_hours" text;

-- 3. Replace over_limit_mode enum column with a simple boolean in gym_settings
ALTER TABLE "gym_settings" DROP COLUMN "over_limit_mode";
ALTER TABLE "gym_settings" ADD COLUMN "allow_over_limit" boolean NOT NULL DEFAULT false;
DROP TYPE "public"."over_limit_mode";

-- 4. Add birth_date and joined_at to members
ALTER TABLE "members" ADD COLUMN "birth_date" date;
ALTER TABLE "members" ADD COLUMN "joined_at" date;

-- 5. Add plan_type to membership_plans and make credits_per_month nullable
ALTER TABLE "membership_plans"
  ADD COLUMN "plan_type" "plan_type" NOT NULL DEFAULT 'credits';
ALTER TABLE "membership_plans"
  ALTER COLUMN "credits_per_month" DROP NOT NULL;

-- 6. Create credit_adjustments table
CREATE TABLE "credit_adjustments" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "gym_id"      uuid NOT NULL,
  "member_id"   uuid NOT NULL,
  "amount"      integer NOT NULL,
  "date"        date NOT NULL,
  "recorded_by" uuid NOT NULL,
  "notes"       text,
  "created_at"  timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "credit_adjustments_gym_id_fk"
    FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE,
  CONSTRAINT "credit_adjustments_member_id_fk"
    FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE,
  CONSTRAINT "credit_adjustments_recorded_by_fk"
    FOREIGN KEY ("recorded_by") REFERENCES "profiles"("id")
);

-- Index for the credits calculation query
CREATE INDEX "credit_adjustments_gym_member_date_idx"
  ON "credit_adjustments" ("gym_id", "member_id", "date");
