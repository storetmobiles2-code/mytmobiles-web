-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "view" TEXT;

-- CreateTable
CREATE TABLE "ProductSpin" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "color" TEXT,
    "frames" TEXT[],
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sourceUrl" TEXT,
    "credit" TEXT,
    "license" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSpin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductSpin_productId_color_idx" ON "ProductSpin"("productId", "color");

-- AddForeignKey
ALTER TABLE "ProductSpin" ADD CONSTRAINT "ProductSpin_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
