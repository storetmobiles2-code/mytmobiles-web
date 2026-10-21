-- CreateEnum
CREATE TYPE "GrievanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "GrievanceCategory" AS ENUM ('ORDER', 'DELIVERY', 'REFUND', 'PRODUCT', 'OTHER');

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "grievanceOfficerDesignation" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "grievanceOfficerEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "grievanceOfficerName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "grievanceOfficerPhone" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "Grievance" (
    "id" TEXT NOT NULL,
    "ticket" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "orderNumber" TEXT,
    "category" "GrievanceCategory" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "GrievanceStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grievance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrievanceEvent" (
    "id" TEXT NOT NULL,
    "grievanceId" TEXT NOT NULL,
    "status" "GrievanceStatus",
    "message" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrievanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Grievance_ticket_key" ON "Grievance"("ticket");

-- CreateIndex
CREATE INDEX "Grievance_status_createdAt_idx" ON "Grievance"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Grievance_email_idx" ON "Grievance"("email");

-- CreateIndex
CREATE INDEX "Grievance_userId_idx" ON "Grievance"("userId");

-- CreateIndex
CREATE INDEX "GrievanceEvent_grievanceId_createdAt_idx" ON "GrievanceEvent"("grievanceId", "createdAt");

-- AddForeignKey
ALTER TABLE "GrievanceEvent" ADD CONSTRAINT "GrievanceEvent_grievanceId_fkey" FOREIGN KEY ("grievanceId") REFERENCES "Grievance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
