-- CreateEnum
CREATE TYPE "VisualisationJobState" AS ENUM ('QUEUED', 'PREPARING', 'GENERATING', 'SAVING', 'SUCCEEDED', 'FAILED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "VisualisationPlan" (
    "id" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisualisationPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisualisationRoom" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "region" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisualisationRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisualisationBatch" (
    "id" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "retryOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisualisationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisualisationJob" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "roomId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'IMAGE',
    "state" "VisualisationJobState" NOT NULL DEFAULT 'QUEUED',
    "input" JSONB NOT NULL,
    "result" JSONB,
    "outputKey" TEXT,
    "thumbnailKey" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "errorCode" TEXT,
    "providerRequestId" TEXT,
    "claimToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisualisationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisualisationPublication" (
    "roomId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "publishedById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisualisationPublication_pkey" PRIMARY KEY ("roomId")
);

-- CreateTable
CREATE TABLE "VisualisationAudit" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisualisationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisualisationPlan_apartmentId_key" ON "VisualisationPlan"("apartmentId");

-- CreateIndex
CREATE INDEX "VisualisationRoom_planId_archived_idx" ON "VisualisationRoom"("planId", "archived");

-- CreateIndex
CREATE INDEX "VisualisationBatch_companyId_createdAt_idx" ON "VisualisationBatch"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VisualisationBatch_apartmentId_clientRequestId_key" ON "VisualisationBatch"("apartmentId", "clientRequestId");

-- CreateIndex
CREATE INDEX "VisualisationJob_state_createdAt_idx" ON "VisualisationJob"("state", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VisualisationJob_batchId_roomId_key" ON "VisualisationJob"("batchId", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "VisualisationPublication_jobId_key" ON "VisualisationPublication"("jobId");

-- AddForeignKey
ALTER TABLE "VisualisationPlan" ADD CONSTRAINT "VisualisationPlan_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "apartments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisualisationRoom" ADD CONSTRAINT "VisualisationRoom_planId_fkey" FOREIGN KEY ("planId") REFERENCES "VisualisationPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisualisationBatch" ADD CONSTRAINT "VisualisationBatch_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "apartments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisualisationJob" ADD CONSTRAINT "VisualisationJob_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "VisualisationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisualisationJob" ADD CONSTRAINT "VisualisationJob_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "VisualisationRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisualisationPublication" ADD CONSTRAINT "VisualisationPublication_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "VisualisationRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisualisationPublication" ADD CONSTRAINT "VisualisationPublication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "VisualisationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Cross-batch exclusion for paid work; Prisma schema cannot express partial indexes.
CREATE UNIQUE INDEX "VisualisationJob_active_room" ON "VisualisationJob" ("roomId")
WHERE "roomId" IS NOT NULL AND state IN ('QUEUED','PREPARING','GENERATING','SAVING');
