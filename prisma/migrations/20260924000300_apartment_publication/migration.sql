-- CreateTable
CREATE TABLE "ApartmentVisualisationPublication" (
    "apartmentId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "publishedById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApartmentVisualisationPublication_pkey" PRIMARY KEY ("apartmentId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApartmentVisualisationPublication_jobId_key" ON "ApartmentVisualisationPublication"("jobId");

-- AddForeignKey
ALTER TABLE "ApartmentVisualisationPublication" ADD CONSTRAINT "ApartmentVisualisationPublication_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "apartments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApartmentVisualisationPublication" ADD CONSTRAINT "ApartmentVisualisationPublication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "VisualisationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep all legacy records. Carry the current reviewed image forward without
-- regenerating it; prefer a whole-apartment publication when one exists.
INSERT INTO "ApartmentVisualisationPublication" ("apartmentId", "jobId", "publishedById", "publishedAt")
SELECT DISTINCT ON (p."apartmentId") p."apartmentId", v."jobId", v."publishedById", v."publishedAt"
FROM "VisualisationPublication" v
JOIN "VisualisationRoom" r ON r.id = v."roomId"
JOIN "VisualisationPlan" p ON p.id = r."planId"
JOIN "VisualisationJob" j ON j.id = v."jobId"
WHERE r.archived = false AND j.state = 'SUCCEEDED'
  AND (j.input->>'planRevision')::int = p.revision
ORDER BY p."apartmentId", (COALESCE(j.input->>'scope', '') = 'apartment') DESC, v."publishedAt" DESC, v."jobId";
