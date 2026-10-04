-- CreateEnum
CREATE TYPE "ProductCondition" AS ENUM ('NEW', 'DEMO');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "condition" "ProductCondition" NOT NULL DEFAULT 'NEW',
ADD COLUMN     "countryOfOrigin" TEXT,
ADD COLUMN     "manufacturerInfo" TEXT;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "externalNames" TEXT[];

-- CreateIndex
CREATE INDEX "Product_condition_idx" ON "Product"("condition");
