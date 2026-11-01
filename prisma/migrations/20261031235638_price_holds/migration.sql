-- CreateEnum
CREATE TYPE "PriceHoldStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "PriceHold" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "priceBefore" INTEGER NOT NULL,
    "priceAfter" INTEGER NOT NULL,
    "mrp" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "PriceHoldStatus" NOT NULL DEFAULT 'PENDING',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceHold_status_createdAt_idx" ON "PriceHold"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PriceHold_variantId_status_idx" ON "PriceHold"("variantId", "status");

-- AddForeignKey
ALTER TABLE "PriceHold" ADD CONSTRAINT "PriceHold_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
