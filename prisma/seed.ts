import { PrismaClient, ProductSource } from '@prisma/client';
import configuration from '../src/config/configuration';
import { calculateSustainabilityScore } from '../src/modules/sustainability/domain/scoring.engine';
import { CATEGORY_TREE } from './seed/categories.data';
import { STORE_SEEDS } from './seed/stores.data';
import { generateProducts } from './seed/product-generator';
import { createSeededRng } from './seed/rng';

const prisma = new PrismaClient();

const SEED_STRING = 'liquiverde-v1';

/**
 * Prisma's compound-unique WHERE input for `@@unique([name, parentId])`
 * requires a non-null `parentId` (a known limitation with nullable columns
 * in compound unique indexes), so root categories — which use
 * `parentId: null` by design — can't go through `upsert()`. This
 * find-or-create is safe here because the seed runs as a single sequential
 * process, not under concurrent writers.
 */
async function findOrCreateCategory(
  name: string,
  parentId: string | null,
): Promise<string> {
  const existing = await prisma.category.findFirst({
    where: { name, parentId },
  });
  if (existing) return existing.id;
  const created = await prisma.category.create({ data: { name, parentId } });
  return created.id;
}

async function upsertCategories(): Promise<Map<string, string>> {
  const idByName = new Map<string, string>();

  for (const root of CATEGORY_TREE) {
    const rootId = await findOrCreateCategory(root.name, null);
    idByName.set(root.name, rootId);

    for (const childName of root.children ?? []) {
      const childId = await findOrCreateCategory(childName, rootId);
      idByName.set(childName, childId);
    }
  }

  return idByName;
}

async function upsertStores(): Promise<void> {
  for (const store of STORE_SEEDS) {
    await prisma.store.upsert({
      where: { name: store.name },
      update: {
        chain: store.chain,
        address: store.address,
        lat: store.lat,
        lng: store.lng,
      },
      create: store,
    });
  }
}

async function upsertProducts(
  categoryIdByName: Map<string, string>,
): Promise<string[]> {
  const rng = createSeededRng(SEED_STRING);
  const generated = generateProducts(rng);
  const productIds: string[] = [];

  for (const p of generated) {
    const categoryId = categoryIdByName.get(p.categoryLeafName);
    if (!categoryId) {
      throw new Error(
        `Seed data references unknown category "${p.categoryLeafName}"`,
      );
    }

    const row = await prisma.product.upsert({
      where: { barcode: p.barcode },
      update: {
        name: p.name,
        brand: p.brand,
        categoryId,
        price: p.price,
        priceIsEstimated: false,
        carbonFootprintKg: p.carbonFootprintKg,
        originCountry: p.originCountry,
        originDistanceKm: p.originDistanceKm,
        packagingScore: p.packagingScore,
        socialCertifications: p.socialCertifications,
        ecoLabel: p.ecoLabel,
        source: ProductSource.SEED,
      },
      create: {
        barcode: p.barcode,
        name: p.name,
        brand: p.brand,
        categoryId,
        price: p.price,
        priceIsEstimated: false,
        carbonFootprintKg: p.carbonFootprintKg,
        originCountry: p.originCountry,
        originDistanceKm: p.originDistanceKm,
        packagingScore: p.packagingScore,
        socialCertifications: p.socialCertifications,
        ecoLabel: p.ecoLabel,
        source: ProductSource.SEED,
      },
    });
    productIds.push(row.id);
  }

  return productIds;
}

/**
 * Scores every seeded product using the SAME pure engine the running app
 * uses (no drift between the example dataset and the real algorithm).
 * Category averages are computed from the just-inserted dataset itself.
 */
async function scoreProducts(productIds: string[]): Promise<void> {
  const config = configuration();
  const weights = {
    economic: config.scoring.weightEconomic,
    env: config.scoring.weightEnv,
    social: config.scoring.weightSocial,
  };

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });
  const categoryIds = [...new Set(products.map((p) => p.categoryId))];

  const pricingByCategory = new Map<
    string,
    { avgPrice: number | null; avgCarbon: number | null }
  >();
  for (const categoryId of categoryIds) {
    const agg = await prisma.product.aggregate({
      where: { categoryId },
      _avg: { price: true, carbonFootprintKg: true },
    });
    pricingByCategory.set(categoryId, {
      avgPrice: agg._avg.price?.toNumber() ?? null,
      avgCarbon: agg._avg.carbonFootprintKg?.toNumber() ?? null,
    });
  }

  for (const product of products) {
    const pricing = pricingByCategory.get(product.categoryId)!;
    const result = calculateSustainabilityScore({
      price: product.price.toNumber(),
      categoryAvgPrice: pricing.avgPrice,
      carbonFootprintKg: product.carbonFootprintKg?.toNumber() ?? null,
      categoryAvgCarbon: pricing.avgCarbon,
      packagingScore: product.packagingScore?.toNumber() ?? null,
      originDistanceKm: product.originDistanceKm?.toNumber() ?? null,
      socialCertifications: product.socialCertifications,
      weights,
    });

    const calculatedAt = new Date();
    await prisma.$transaction([
      prisma.sustainabilityScore.create({
        data: {
          productId: product.id,
          economicScore: result.economicScore,
          envScore: result.envScore,
          socialScore: result.socialScore,
          finalScore: result.finalScore,
          dataConfidence: result.dataConfidence,
          missingFields: result.missingFields,
          calculatedAt,
        },
      }),
      prisma.product.update({
        where: { id: product.id },
        data: {
          economicScoreCache: result.economicScore,
          envScoreCache: result.envScore,
          socialScoreCache: result.socialScore,
          finalScoreCache: result.finalScore,
          dataConfidence: result.dataConfidence,
          scoreCalculatedAt: calculatedAt,
        },
      }),
    ]);
  }
}

async function main() {
  console.log('Seeding categories...');
  const categoryIdByName = await upsertCategories();
  console.log(`  ${categoryIdByName.size} categories ready.`);

  console.log('Seeding stores...');
  await upsertStores();
  console.log(`  ${STORE_SEEDS.length} stores ready.`);

  console.log('Seeding synthetic product catalog (RF-13)...');
  const productIds = await upsertProducts(categoryIdByName);
  console.log(`  ${productIds.length} products ready.`);

  console.log(
    'Scoring products (RF-03, using the production scoring engine)...',
  );
  await scoreProducts(productIds);
  console.log('  Done.');

  console.log(
    '\nNOTE: product prices, carbon footprints and origins are synthetic — generated ' +
      'programmatically to satisfy RF-13, not measured real-market data. See README.',
  );
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
