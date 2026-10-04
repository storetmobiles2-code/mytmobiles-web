-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "discountPct" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "inStock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mrpFrom" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "priceFrom" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Product_priceFrom_idx" ON "Product"("priceFrom");
