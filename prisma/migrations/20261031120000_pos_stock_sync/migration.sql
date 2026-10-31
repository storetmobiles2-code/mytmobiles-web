-- CreateTable
CREATE TABLE "PosStockItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosStockItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PosStockItem_nameKey_idx" ON "PosStockItem"("nameKey");
