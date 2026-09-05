import { generateEan13 } from './ean13';
import type { createSeededRng } from './rng';

type SeededRng = ReturnType<typeof createSeededRng>;

export interface GeneratedProduct {
  barcode: string;
  name: string;
  brand: string;
  categoryLeafName: string;
  price: number;
  carbonFootprintKg: number;
  originCountry: string;
  originDistanceKm: number;
  packagingScore: number;
  socialCertifications: string[];
  ecoLabel: string | null;
}

interface CategoryProfile {
  leafName: string;
  productNames: string[];
  priceRangeCLP: [number, number];
  /** kg CO2e per unit — illustrative, informed by general known patterns
   *  (meat/dairy > processed/packaged > grains/legumes > fresh produce),
   *  NOT measured data. See README "Dataset sintético". */
  carbonRangeKg: [number, number];
  packagingScoreRange: [number, number];
  originLocalProbability: number;
  certificationProbability: number;
}

const BRAND_POOL = [
  'Andes Natural',
  'Valle Verde',
  'Cosecha Real',
  'Terra Viva',
  'Pura Vida',
  'NutriChile',
  'Del Campo',
  'Raíces',
  'Origen Sur',
  'EcoHogar',
  'Bienestar',
  'Sabores del Sur',
  'Tres Marías',
  'Loncoche',
  'Patagonia Fresh',
];

const IMPORT_COUNTRIES = [
  'Argentina',
  'Brasil',
  'Perú',
  'España',
  'Estados Unidos',
  'China',
];

const CERTIFICATION_POOL = [
  'Comercio Justo',
  'Orgánico Certificado',
  'B-Corp',
  'Rainforest Alliance',
];

const CATEGORY_PROFILES: CategoryProfile[] = [
  {
    leafName: 'Leches',
    productNames: [
      'Leche Entera 1L',
      'Leche Descremada 1L',
      'Leche Semidescremada 1L',
      'Leche Deslactosada 1L',
    ],
    priceRangeCLP: [900, 1500],
    carbonRangeKg: [1.0, 1.5],
    packagingScoreRange: [40, 60],
    originLocalProbability: 0.9,
    certificationProbability: 0.2,
  },
  {
    leafName: 'Yogures y Postres',
    productNames: [
      'Yogur Natural 1kg',
      'Yogur Griego 150g',
      'Postre de Vainilla 120g',
      'Yogur Bebible 1L',
    ],
    priceRangeCLP: [1200, 3000],
    carbonRangeKg: [0.8, 1.3],
    packagingScoreRange: [30, 50],
    originLocalProbability: 0.85,
    certificationProbability: 0.15,
  },
  {
    leafName: 'Frutas Frescas',
    productNames: [
      'Manzanas kg',
      'Plátanos kg',
      'Naranjas kg',
      'Paltas kg',
      'Uvas kg',
    ],
    priceRangeCLP: [800, 2500],
    carbonRangeKg: [0.1, 0.4],
    packagingScoreRange: [70, 95],
    originLocalProbability: 0.7,
    certificationProbability: 0.3,
  },
  {
    leafName: 'Verduras Frescas',
    productNames: [
      'Tomates kg',
      'Lechuga unidad',
      'Zanahorias kg',
      'Papas kg',
      'Cebollas kg',
    ],
    priceRangeCLP: [500, 1800],
    carbonRangeKg: [0.1, 0.3],
    packagingScoreRange: [75, 95],
    originLocalProbability: 0.9,
    certificationProbability: 0.25,
  },
  {
    leafName: 'Panes',
    productNames: [
      'Pan Marraqueta kg',
      'Pan Integral 500g',
      'Pan de Molde 500g',
      'Pan Pita 300g',
    ],
    priceRangeCLP: [900, 2200],
    carbonRangeKg: [0.3, 0.6],
    packagingScoreRange: [40, 70],
    originLocalProbability: 0.95,
    certificationProbability: 0.1,
  },
  {
    leafName: 'Pastelería',
    productNames: [
      'Torta Individual',
      'Kuchen de Manzana',
      'Alfajor Artesanal',
      'Berlín Relleno',
    ],
    priceRangeCLP: [1200, 3500],
    carbonRangeKg: [0.5, 1.0],
    packagingScoreRange: [25, 45],
    originLocalProbability: 0.9,
    certificationProbability: 0.05,
  },
  {
    leafName: 'Snacks Salados',
    productNames: [
      'Papas Fritas 150g',
      'Maní Salado 200g',
      'Palitos de Queso 100g',
      'Snack de Maíz 120g',
    ],
    priceRangeCLP: [900, 2500],
    carbonRangeKg: [0.4, 0.9],
    packagingScoreRange: [20, 40],
    originLocalProbability: 0.5,
    certificationProbability: 0.05,
  },
  {
    leafName: 'Snacks Dulces',
    productNames: [
      'Chocolate 100g',
      'Galletas Rellenas 200g',
      'Barra de Cereal 30g',
      'Gomitas 150g',
    ],
    priceRangeCLP: [700, 2200],
    carbonRangeKg: [0.4, 0.9],
    packagingScoreRange: [20, 40],
    originLocalProbability: 0.4,
    certificationProbability: 0.15,
  },
  {
    leafName: 'Bebidas Gaseosas',
    productNames: [
      'Bebida Cola 1.5L',
      'Bebida Sabor Naranja 1.5L',
      'Agua Tónica 1.5L',
      'Bebida Light 1.5L',
    ],
    priceRangeCLP: [900, 2000],
    carbonRangeKg: [0.3, 0.6],
    packagingScoreRange: [30, 50],
    originLocalProbability: 0.8,
    certificationProbability: 0.02,
  },
  {
    leafName: 'Jugos y Aguas',
    productNames: [
      'Agua Mineral 1.5L',
      'Jugo de Naranja 1L',
      'Jugo Multifruta 1L',
      'Agua Saborizada 500ml',
    ],
    priceRangeCLP: [500, 1800],
    carbonRangeKg: [0.2, 0.5],
    packagingScoreRange: [35, 60],
    originLocalProbability: 0.85,
    certificationProbability: 0.1,
  },
  {
    leafName: 'Cereales y Legumbres',
    productNames: [
      'Arroz Grado 1 kg',
      'Lentejas kg',
      'Porotos kg',
      'Avena 500g',
      'Quinoa 500g',
    ],
    priceRangeCLP: [900, 3200],
    carbonRangeKg: [0.3, 0.7],
    packagingScoreRange: [50, 75],
    originLocalProbability: 0.7,
    certificationProbability: 0.35,
  },
  {
    leafName: 'Aceites y Condimentos',
    productNames: [
      'Aceite de Oliva 500ml',
      'Aceite Vegetal 1L',
      'Sal de Mesa 500g',
      'Vinagre 500ml',
      'Salsa de Soya 250ml',
    ],
    priceRangeCLP: [1500, 6000],
    carbonRangeKg: [0.3, 0.8],
    packagingScoreRange: [45, 70],
    originLocalProbability: 0.55,
    certificationProbability: 0.25,
  },
  {
    leafName: 'Carnes Rojas y Aves',
    productNames: [
      'Carne Molida kg',
      'Pollo Entero kg',
      'Filete de Vacuno kg',
      'Cerdo kg',
    ],
    priceRangeCLP: [4000, 12000],
    carbonRangeKg: [3.5, 8.0],
    packagingScoreRange: [30, 50],
    originLocalProbability: 0.85,
    certificationProbability: 0.1,
  },
  {
    leafName: 'Proteínas Vegetales',
    productNames: [
      'Tofu 300g',
      'Hamburguesa Vegetal 4un',
      'Lentejas Cocidas 400g',
      'Proteína de Soya Texturizada 250g',
    ],
    priceRangeCLP: [1500, 4500],
    carbonRangeKg: [0.4, 1.0],
    packagingScoreRange: [45, 65],
    originLocalProbability: 0.5,
    certificationProbability: 0.3,
  },
  {
    leafName: 'Limpieza',
    productNames: [
      'Detergente Líquido 1L',
      'Cloro 1L',
      'Limpiador Multiuso 500ml',
      'Esponja x3',
    ],
    priceRangeCLP: [1200, 4500],
    carbonRangeKg: [0.5, 1.2],
    packagingScoreRange: [25, 45],
    originLocalProbability: 0.6,
    certificationProbability: 0.05,
  },
  {
    leafName: 'Cuidado del Hogar',
    productNames: [
      'Papel Higiénico x4',
      'Toalla de Papel x2',
      'Bolsas de Basura x20',
      'Servilletas x100',
    ],
    priceRangeCLP: [1500, 5000],
    carbonRangeKg: [0.3, 0.9],
    packagingScoreRange: [30, 55],
    originLocalProbability: 0.65,
    certificationProbability: 0.05,
  },
];

/** Generates the synthetic catalog (RF-13) — deterministic given the RNG's seed. */
export function generateProducts(rng: SeededRng): GeneratedProduct[] {
  const products: GeneratedProduct[] = [];
  let sequence = 1;

  for (const profile of CATEGORY_PROFILES) {
    const count = rng.int(4, 5);
    const names: string[] = [];
    while (names.length < count) {
      names.push(rng.pick(profile.productNames));
    }

    for (const baseName of names) {
      const brand = rng.pick(BRAND_POOL);
      const price = Math.round(rng.float(...profile.priceRangeCLP) / 10) * 10;
      const carbonFootprintKg = Number(
        rng.float(...profile.carbonRangeKg).toFixed(2),
      );
      const isLocal = rng.bool(profile.originLocalProbability);
      const originCountry = isLocal ? 'Chile' : rng.pick(IMPORT_COUNTRIES);
      const originDistanceKm = isLocal
        ? rng.int(30, 300)
        : rng.int(1500, 12000);
      const packagingScore = Math.round(
        rng.float(...profile.packagingScoreRange),
      );
      const certCount = rng.bool(profile.certificationProbability)
        ? rng.int(1, 2)
        : 0;
      const socialCertifications =
        certCount > 0 ? rng.pickSome(CERTIFICATION_POOL, certCount) : [];
      const ecoLabel =
        isLocal && rng.bool(0.15) ? 'Sello Verde Nacional' : null;

      products.push({
        barcode: generateEan13(sequence++),
        name: `${baseName} ${brand}`,
        brand,
        categoryLeafName: profile.leafName,
        price,
        carbonFootprintKg,
        originCountry,
        originDistanceKm,
        packagingScore,
        socialCertifications,
        ecoLabel,
      });
    }
  }

  return products;
}
