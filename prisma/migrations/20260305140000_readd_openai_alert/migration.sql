-- CreateTable
CREATE TABLE IF NOT EXISTS "OpenAIAlert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenAIAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OpenAIAlert_type_idx" ON "OpenAIAlert"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OpenAIAlert_enabled_idx" ON "OpenAIAlert"("enabled");
