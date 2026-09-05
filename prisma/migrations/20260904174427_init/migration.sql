-- CreateEnum
CREATE TYPE "ProductSource" AS ENUM ('SEED', 'OPENFOODFACTS', 'USDA');

-- CreateEnum
CREATE TYPE "DataConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ShoppingListStatus" AS ENUM ('DRAFT', 'OPTIMIZED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RewardReason" AS ENUM ('HIGH_SCORE_ITEM_INCLUDED', 'SUBSTITUTION_ACCEPTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "budgetDefault" DECIMAL(10,2),
    "rewardPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" UUID,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "categoryId" UUID NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "priceIsEstimated" BOOLEAN NOT NULL DEFAULT false,
    "currency" CHAR(3) NOT NULL DEFAULT 'CLP',
    "carbonFootprintKg" DECIMAL(8,3),
    "originCountry" TEXT,
    "originDistanceKm" DECIMAL(8,1),
    "packagingScore" DECIMAL(5,2),
    "socialCertifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ecoLabel" TEXT,
    "source" "ProductSource" NOT NULL DEFAULT 'SEED',
    "economicScoreCache" DECIMAL(5,2),
    "envScoreCache" DECIMAL(5,2),
    "socialScoreCache" DECIMAL(5,2),
    "finalScoreCache" DECIMAL(5,2),
    "dataConfidence" "DataConfidence" NOT NULL DEFAULT 'LOW',
    "scoreCalculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sustainability_scores" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "economicScore" DECIMAL(5,2) NOT NULL,
    "envScore" DECIMAL(5,2) NOT NULL,
    "socialScore" DECIMAL(5,2) NOT NULL,
    "finalScore" DECIMAL(5,2) NOT NULL,
    "dataConfidence" "DataConfidence" NOT NULL,
    "missingFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sustainability_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "chain" TEXT,
    "address" TEXT NOT NULL,
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_lists" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "budgetMax" DECIMAL(10,2) NOT NULL,
    "status" "ShoppingListStatus" NOT NULL DEFAULT 'DRAFT',
    "totalEstSaving" DECIMAL(10,2),
    "totalImpactScore" DECIMAL(5,2),
    "plannedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopping_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_items" (
    "id" UUID NOT NULL,
    "listId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "includedInOptimum" BOOLEAN NOT NULL DEFAULT false,
    "substitutedFromId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_events" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" "RewardReason" NOT NULL,
    "sourceListItemId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_parentId_key" ON "categories"("name", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

-- CreateIndex
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

-- CreateIndex
CREATE INDEX "products_finalScoreCache_idx" ON "products"("finalScoreCache");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE INDEX "products_brand_idx" ON "products"("brand");

-- CreateIndex
CREATE INDEX "sustainability_scores_productId_calculatedAt_idx" ON "sustainability_scores"("productId", "calculatedAt");

-- CreateIndex
CREATE INDEX "stores_lat_lng_idx" ON "stores"("lat", "lng");

-- CreateIndex
CREATE UNIQUE INDEX "stores_name_key" ON "stores"("name");

-- CreateIndex
CREATE INDEX "price_history_productId_storeId_recordedAt_idx" ON "price_history"("productId", "storeId", "recordedAt");

-- CreateIndex
CREATE INDEX "shopping_lists_userId_status_idx" ON "shopping_lists"("userId", "status");

-- CreateIndex
CREATE INDEX "shopping_lists_userId_createdAt_idx" ON "shopping_lists"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "list_items_listId_idx" ON "list_items"("listId");

-- CreateIndex
CREATE INDEX "list_items_productId_idx" ON "list_items"("productId");

-- CreateIndex
CREATE INDEX "list_items_substitutedFromId_idx" ON "list_items"("substitutedFromId");

-- CreateIndex
CREATE INDEX "reward_events_userId_createdAt_idx" ON "reward_events"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sustainability_scores" ADD CONSTRAINT "sustainability_scores_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_listId_fkey" FOREIGN KEY ("listId") REFERENCES "shopping_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_substitutedFromId_fkey" FOREIGN KEY ("substitutedFromId") REFERENCES "list_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_events" ADD CONSTRAINT "reward_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_events" ADD CONSTRAINT "reward_events_sourceListItemId_fkey" FOREIGN KEY ("sourceListItemId") REFERENCES "list_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
