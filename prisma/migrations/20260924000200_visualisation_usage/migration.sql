-- CreateTable
CREATE TABLE "VisualisationUsage" (
    "jobId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisualisationUsage_pkey" PRIMARY KEY ("jobId")
);

-- CreateIndex
CREATE INDEX "VisualisationUsage_companyId_kind_createdAt_idx" ON "VisualisationUsage"("companyId", "kind", "createdAt");

-- Preserve existing reservations when upgrading; accepted calls remain charged even
-- after their apartment or batch is deleted.
INSERT INTO "VisualisationUsage" ("jobId", "companyId", "kind", "releasedAt", "createdAt")
SELECT j.id, b."companyId", j.kind,
       CASE WHEN j."submittedAt" IS NULL AND j.state IN ('FAILED', 'SUPERSEDED') THEN NOW() ELSE NULL END,
       b."createdAt"
FROM "VisualisationJob" j JOIN "VisualisationBatch" b ON b.id = j."batchId";
