export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigin: string;
}

export interface DatabaseConfig {
  url: string;
}

export interface RedisConfig {
  url: string;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
}

export interface ExternalApisConfig {
  openFoodFactsBaseUrl: string;
  usdaApiKey: string | undefined;
  nominatimBaseUrl: string;
  nominatimUserAgent: string;
}

export interface ScoringConfig {
  weightEconomic: number;
  weightEnv: number;
  weightSocial: number;
}

export interface KnapsackConfig {
  weightUtility: number;
  weightSustainability: number;
  weightSaving: number;
  discretizationStepCents: number;
  maxStepCents: number;
  maxDpCells: number;
  maxItemsDp: number;
}

export interface SubstitutionConfig {
  maxPriceIncreasePct: number;
  weightScore: number;
  weightPrice: number;
  weightSimilarity: number;
}

export interface RateLimitConfig {
  ttl: number;
  max: number;
}

export interface RootConfig {
  app: AppConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  jwt: JwtConfig;
  externalApis: ExternalApisConfig;
  scoring: ScoringConfig;
  knapsack: KnapsackConfig;
  substitution: SubstitutionConfig;
  rateLimit: RateLimitConfig;
}

export default (): RootConfig => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
  },
  database: {
    url: process.env.DATABASE_URL as string,
  },
  redis: {
    url: process.env.REDIS_URL as string,
  },
  jwt: {
    secret: process.env.JWT_SECRET as string,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '2h',
  },
  externalApis: {
    openFoodFactsBaseUrl: process.env.OPENFOODFACTS_BASE_URL as string,
    usdaApiKey: process.env.USDA_API_KEY ? process.env.USDA_API_KEY : undefined,
    nominatimBaseUrl: process.env.NOMINATIM_BASE_URL as string,
    nominatimUserAgent:
      process.env.NOMINATIM_USER_AGENT ?? 'LiquiVerde-Tech-Test/1.0',
  },
  scoring: {
    weightEconomic: parseFloat(process.env.SCORING_WEIGHT_ECONOMIC ?? '0.4'),
    weightEnv: parseFloat(process.env.SCORING_WEIGHT_ENV ?? '0.35'),
    weightSocial: parseFloat(process.env.SCORING_WEIGHT_SOCIAL ?? '0.25'),
  },
  knapsack: {
    weightUtility: parseFloat(process.env.KNAPSACK_WEIGHT_UTILITY ?? '0.34'),
    weightSustainability: parseFloat(
      process.env.KNAPSACK_WEIGHT_SUSTAINABILITY ?? '0.33',
    ),
    weightSaving: parseFloat(process.env.KNAPSACK_WEIGHT_SAVING ?? '0.33'),
    discretizationStepCents: parseInt(
      process.env.KNAPSACK_DISCRETIZATION_STEP_CENTS ?? '50',
      10,
    ),
    maxStepCents: parseInt(process.env.KNAPSACK_MAX_STEP_CENTS ?? '5000', 10),
    maxDpCells: parseInt(process.env.KNAPSACK_MAX_DP_CELLS ?? '4000000', 10),
    maxItemsDp: parseInt(process.env.KNAPSACK_MAX_ITEMS_DP ?? '500', 10),
  },
  substitution: {
    maxPriceIncreasePct: parseFloat(
      process.env.SUBSTITUTION_MAX_PRICE_INCREASE_PCT ?? '10',
    ),
    weightScore: parseFloat(process.env.SUBSTITUTION_WEIGHT_SCORE ?? '0.5'),
    weightPrice: parseFloat(process.env.SUBSTITUTION_WEIGHT_PRICE ?? '0.2'),
    weightSimilarity: parseFloat(
      process.env.SUBSTITUTION_WEIGHT_SIMILARITY ?? '0.3',
    ),
  },
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL ?? '60', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
  },
});
