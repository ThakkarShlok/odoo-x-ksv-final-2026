-- ============================================================================
-- MIGRATION 006 — PRODUCT IMAGES  (phase-1 catalogue depth)
-- ============================================================================
-- Additive only: one new table, one FK, one plain index (all Prisma-generated), plus ONE
-- hand-written PARTIAL UNIQUE INDEX that Prisma cannot express. No existing column or constraint
-- is touched, so this is safe to `migrate deploy` onto the live demo DB.
--
-- Applied with `prisma migrate deploy` (not `migrate dev`) for the SAME reason as migration 005:
-- a pre-existing checksum mismatch on migration 003 makes `migrate dev` demand a destructive reset.
-- `deploy` applies only pending migrations and never touches applied ones, so no data is lost.
-- See docs/backend-divergences.md #1.

-- CreateTable (Prisma-generated) ---------------------------------------------
CREATE TABLE "product_images" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (Prisma-generated) ---------------------------------------------
CREATE INDEX "product_images_productId_sortOrder_idx" ON "product_images"("productId", "sortOrder");

-- AddForeignKey (Prisma-generated) -------------------------------------------
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PARTIAL UNIQUE INDEX (hand-written — Prisma cannot express a filtered unique index) ---------
-- "At most one primary image per product." A plain UNIQUE("productId","isPrimary") would wrongly
-- forbid a product from having more than one NON-primary image too. The partial index constrains
-- ONLY the rows where isPrimary = true, so: many gallery images, exactly one thumbnail. Same
-- pattern and rationale as pricelists_one_default / addresses_one_default_per_user in migration 004.
-- The admin "set primary" path flips the old primary off and the new one on inside one transaction,
-- so this invariant is enforced by the DB, not merely by hopeful application code.
CREATE UNIQUE INDEX "product_images_one_primary"
  ON "product_images" ("productId")
  WHERE "isPrimary" = true;
