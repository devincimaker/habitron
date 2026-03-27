-- Date.now() returns milliseconds (~1.77 trillion in 2026), which overflows INTEGER.
-- Change sort_order columns to BIGINT to support millisecond timestamps.

ALTER TABLE "public"."todo_lists"
  ALTER COLUMN "sort_order" SET DATA TYPE BIGINT;

ALTER TABLE "public"."todos"
  ALTER COLUMN "sort_order" SET DATA TYPE BIGINT;
