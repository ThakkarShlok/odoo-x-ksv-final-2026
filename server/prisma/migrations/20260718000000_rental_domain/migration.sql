-- Migration 003 — rental domain (all Prisma-MODELABLE objects: tables, enums, FKs, plain indexes).
-- PROVENANCE: produced with `prisma migrate diff --from-schema-datasource --to-schema-datamodel
-- --script`, then applied with `prisma migrate deploy`. diff+deploy was used instead of
-- `migrate dev` only because narrowing the Role enum raises an interactive confirmation that
-- cannot run in a non-interactive shell; the SQL below is what migrate dev would have written.
-- Everything Prisma CANNOT express (EXCLUDE no-overlap, partial unique indexes, CHECK
-- constraints, deposit-balance trigger, partial "pending events" index) lives in migration 004.
-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('SHIPPING', 'BILLING');

-- CreateEnum
CREATE TYPE "ProductCondition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED');

-- CreateEnum
CREATE TYPE "ProductUnitStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'RENTED', 'MAINTENANCE', 'DAMAGED', 'RETIRED');

-- CreateEnum
CREATE TYPE "DurationUnit" AS ENUM ('HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "FulfillmentMethod" AS ENUM ('STORE_PICKUP', 'DELIVERY');

-- CreateEnum
CREATE TYPE "RentalOrderStatus" AS ENUM ('QUOTATION', 'CONFIRMED', 'PICKED_UP', 'IN_RENTAL', 'RETURNED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('HELD', 'ACTIVE', 'FULFILLED', 'RELEASED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('RENTAL', 'DEPOSIT', 'LATE_FEE');

-- CreateEnum
CREATE TYPE "DepositEntryType" AS ENUM ('HELD', 'DEDUCTED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "DepositRuleType" AS ENUM ('PERCENTAGE', 'FLAT');

-- CreateEnum
CREATE TYPE "LateFeeRuleType" AS ENUM ('PER_DAY_FLAT', 'PER_DAY_PERCENTAGE', 'FLAT');

-- CreateEnum
CREATE TYPE "RentalEventType" AS ENUM ('PICKUP', 'RETURN');

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'CUSTOMER');
ALTER TABLE "public"."users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
COMMIT;

-- DropForeignKey
ALTER TABLE "items" DROP CONSTRAINT "items_createdById_fkey";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phone" TEXT,
ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';

-- DropTable
DROP TABLE "booking_slot";

-- DropTable
DROP TABLE "items";

-- DropEnum
DROP TYPE "ItemStatus";

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "AddressType" NOT NULL DEFAULT 'SHIPPING',
    "label" TEXT,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT,
    "brand" TEXT,
    "manufacturer" TEXT,
    "color" TEXT,
    "size" TEXT,
    "isRentable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_units" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "condition" "ProductCondition" NOT NULL DEFAULT 'GOOD',
    "status" "ProductUnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricelists" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricelists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricelist_items" (
    "id" UUID NOT NULL,
    "pricelistId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "durationUnit" "DurationUnit" NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricelist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_settings" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "depositRuleType" "DepositRuleType" NOT NULL DEFAULT 'PERCENTAGE',
    "depositValue" DECIMAL(12,2) NOT NULL,
    "gracePeriodHours" INTEGER NOT NULL DEFAULT 0,
    "lateFeeRuleType" "LateFeeRuleType" NOT NULL DEFAULT 'PER_DAY_FLAT',
    "lateFeeValue" DECIMAL(12,2) NOT NULL,
    "maxLateFeeCap" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rental_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_orders" (
    "id" UUID NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "status" "RentalOrderStatus" NOT NULL DEFAULT 'QUOTATION',
    "fulfillmentMethod" "FulfillmentMethod" NOT NULL DEFAULT 'STORE_PICKUP',
    "deliveryAddressId" UUID,
    "pricelistId" UUID,
    "rentalStart" TIMESTAMP(3) NOT NULL,
    "rentalEnd" TIMESTAMP(3) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "depositTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "rental_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_order_lines" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "productUnitId" UUID NOT NULL,
    "durationUnit" "DurationUnit" NOT NULL,
    "durationCount" INTEGER NOT NULL,
    "rateApplied" DECIMAL(12,2) NOT NULL,
    "lineSubtotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productUnitId" UUID NOT NULL,
    "during" tsrange NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'HELD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "method" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_ledger" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "entryType" "DepositEntryType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "relatedLateFeeId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "late_fees" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "orderLineId" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "daysLate" INTEGER NOT NULL,
    "ruleType" "LateFeeRuleType" NOT NULL,
    "ruleValue" DECIMAL(12,2) NOT NULL,
    "graceHours" INTEGER NOT NULL,
    "capAmount" DECIMAL(12,2) NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "late_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(12,2) NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_events" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "eventType" "RentalEventType" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "actualAt" TIMESTAMP(3),
    "conditionNotes" TEXT,
    "damageFlag" BOOLEAN NOT NULL DEFAULT false,
    "inspectedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "addresses_userId_idx" ON "addresses"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_categoryId_isRentable_idx" ON "products"("categoryId", "isRentable");

-- CreateIndex
CREATE UNIQUE INDEX "product_units_serialNumber_key" ON "product_units"("serialNumber");

-- CreateIndex
CREATE INDEX "product_units_productId_status_idx" ON "product_units"("productId", "status");

-- CreateIndex
CREATE INDEX "pricelist_items_productId_idx" ON "pricelist_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "pricelist_items_pricelistId_productId_durationUnit_key" ON "pricelist_items"("pricelistId", "productId", "durationUnit");

-- CreateIndex
CREATE UNIQUE INDEX "rental_orders_orderNumber_key" ON "rental_orders"("orderNumber");

-- CreateIndex
CREATE INDEX "rental_orders_customerId_createdAt_idx" ON "rental_orders"("customerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "rental_orders_status_rentalEnd_idx" ON "rental_orders"("status", "rentalEnd");

-- CreateIndex
CREATE INDEX "rental_orders_status_rentalStart_idx" ON "rental_orders"("status", "rentalStart");

-- CreateIndex
CREATE INDEX "rental_order_lines_orderId_idx" ON "rental_order_lines"("orderId");

-- CreateIndex
CREATE INDEX "rental_order_lines_productId_idx" ON "rental_order_lines"("productId");

-- CreateIndex
CREATE INDEX "rental_order_lines_productUnitId_idx" ON "rental_order_lines"("productUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "rental_order_lines_orderId_productUnitId_key" ON "rental_order_lines"("orderId", "productUnitId");

-- CreateIndex
CREATE INDEX "reservations_productUnitId_idx" ON "reservations"("productUnitId");

-- CreateIndex
CREATE INDEX "reservations_orderId_idx" ON "reservations"("orderId");

-- CreateIndex
CREATE INDEX "payments_orderId_status_idx" ON "payments"("orderId", "status");

-- CreateIndex
CREATE INDEX "deposit_ledger_orderId_createdAt_idx" ON "deposit_ledger"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "deposit_ledger_relatedLateFeeId_idx" ON "deposit_ledger"("relatedLateFeeId");

-- CreateIndex
CREATE INDEX "late_fees_orderId_idx" ON "late_fees"("orderId");

-- CreateIndex
CREATE INDEX "late_fees_orderLineId_idx" ON "late_fees"("orderLineId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoices_orderId_idx" ON "invoices"("orderId");

-- CreateIndex
CREATE INDEX "rental_events_eventType_scheduledAt_idx" ON "rental_events"("eventType", "scheduledAt");

-- CreateIndex
CREATE INDEX "rental_events_orderId_idx" ON "rental_events"("orderId");

-- CreateIndex
CREATE INDEX "rental_events_inspectedById_idx" ON "rental_events"("inspectedById");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_units" ADD CONSTRAINT "product_units_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricelist_items" ADD CONSTRAINT "pricelist_items_pricelistId_fkey" FOREIGN KEY ("pricelistId") REFERENCES "pricelists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricelist_items" ADD CONSTRAINT "pricelist_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_orders" ADD CONSTRAINT "rental_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_orders" ADD CONSTRAINT "rental_orders_deliveryAddressId_fkey" FOREIGN KEY ("deliveryAddressId") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_orders" ADD CONSTRAINT "rental_orders_pricelistId_fkey" FOREIGN KEY ("pricelistId") REFERENCES "pricelists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_order_lines" ADD CONSTRAINT "rental_order_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "rental_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_order_lines" ADD CONSTRAINT "rental_order_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_order_lines" ADD CONSTRAINT "rental_order_lines_productUnitId_fkey" FOREIGN KEY ("productUnitId") REFERENCES "product_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "rental_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_productUnitId_fkey" FOREIGN KEY ("productUnitId") REFERENCES "product_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_ledger" ADD CONSTRAINT "deposit_ledger_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_ledger" ADD CONSTRAINT "deposit_ledger_relatedLateFeeId_fkey" FOREIGN KEY ("relatedLateFeeId") REFERENCES "late_fees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "late_fees" ADD CONSTRAINT "late_fees_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "late_fees" ADD CONSTRAINT "late_fees_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "rental_order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_events" ADD CONSTRAINT "rental_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_events" ADD CONSTRAINT "rental_events_inspectedById_fkey" FOREIGN KEY ("inspectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

