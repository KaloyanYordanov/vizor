-- Safe upgrade for databases created before configurable embeds were introduced.
ALTER TABLE "projects"
ADD COLUMN IF NOT EXISTS "embedConfig" JSONB;
