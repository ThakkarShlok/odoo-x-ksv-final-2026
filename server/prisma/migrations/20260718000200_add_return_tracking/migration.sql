-- Migration 005 — return tracking columns on rental_orders.
-- Additive only: two NULLABLE columns, no changes to existing columns/constraints. Unblocks the
-- return-scan controller, which writes actualReturnTime + totalPenalties on a return.
-- Money stays Decimal(12,2), consistent with every other monetary column.
-- Applied with `prisma migrate deploy` (not `migrate dev`) because migrate dev demanded a
-- destructive reset over a pre-existing checksum mismatch on migration 003 (a teammate edited an
-- already-applied migration; see the divergence inventory). deploy applies pending migrations
-- without touching applied ones, so no data is lost.

-- AlterTable
ALTER TABLE "rental_orders" ADD COLUMN     "actualReturnTime" TIMESTAMP(3),
ADD COLUMN     "totalPenalties" DECIMAL(12,2);
