import * as Joi from 'joi';

export interface ValidatedEnv {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  OPENFOODFACTS_BASE_URL: string;
  USDA_API_KEY: string;
  NOMINATIM_BASE_URL: string;
  NOMINATIM_USER_AGENT: string;
  CORS_ORIGIN: string;
  SCORING_WEIGHT_ECONOMIC: number;
  SCORING_WEIGHT_ENV: number;
  SCORING_WEIGHT_SOCIAL: number;
  KNAPSACK_WEIGHT_UTILITY: number;
  KNAPSACK_WEIGHT_SUSTAINABILITY: number;
  KNAPSACK_WEIGHT_SAVING: number;
  KNAPSACK_DISCRETIZATION_STEP_CENTS: number;
  KNAPSACK_MAX_STEP_CENTS: number;
  KNAPSACK_MAX_DP_CELLS: number;
  KNAPSACK_MAX_ITEMS_DP: number;
  SUBSTITUTION_MAX_PRICE_INCREASE_PCT: number;
  SUBSTITUTION_WEIGHT_SCORE: number;
  SUBSTITUTION_WEIGHT_PRICE: number;
  SUBSTITUTION_WEIGHT_SIMILARITY: number;
  RATE_LIMIT_TTL: number;
  RATE_LIMIT_MAX: number;
}

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),

  DATABASE_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().required(),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('2h'),

  OPENFOODFACTS_BASE_URL: Joi.string().uri().required(),
  USDA_API_KEY: Joi.string().allow('').optional(),
  NOMINATIM_BASE_URL: Joi.string().uri().required(),
  NOMINATIM_USER_AGENT: Joi.string().default('LiquiVerde-Tech-Test/1.0'),

  CORS_ORIGIN: Joi.string().default('http://localhost:4200'),

  SCORING_WEIGHT_ECONOMIC: Joi.number().min(0).max(1).default(0.4),
  SCORING_WEIGHT_ENV: Joi.number().min(0).max(1).default(0.35),
  SCORING_WEIGHT_SOCIAL: Joi.number().min(0).max(1).default(0.25),

  KNAPSACK_WEIGHT_UTILITY: Joi.number().min(0).max(1).default(0.34),
  KNAPSACK_WEIGHT_SUSTAINABILITY: Joi.number().min(0).max(1).default(0.33),
  KNAPSACK_WEIGHT_SAVING: Joi.number().min(0).max(1).default(0.33),
  KNAPSACK_DISCRETIZATION_STEP_CENTS: Joi.number()
    .integer()
    .positive()
    .default(50),
  KNAPSACK_MAX_STEP_CENTS: Joi.number().integer().positive().default(5000),
  KNAPSACK_MAX_DP_CELLS: Joi.number().integer().positive().default(4_000_000),
  KNAPSACK_MAX_ITEMS_DP: Joi.number().integer().positive().default(500),

  SUBSTITUTION_MAX_PRICE_INCREASE_PCT: Joi.number().min(0).default(10),
  SUBSTITUTION_WEIGHT_SCORE: Joi.number().min(0).max(1).default(0.5),
  SUBSTITUTION_WEIGHT_PRICE: Joi.number().min(0).max(1).default(0.2),
  SUBSTITUTION_WEIGHT_SIMILARITY: Joi.number().min(0).max(1).default(0.3),

  RATE_LIMIT_TTL: Joi.number().integer().positive().default(60),
  RATE_LIMIT_MAX: Joi.number().integer().positive().default(100),
});

export function validateEnv(config: Record<string, unknown>): ValidatedEnv {
  const { error, value } = envValidationSchema.validate(config, {
    allowUnknown: true,
    abortEarly: false,
  }) as { error: Joi.ValidationError | undefined; value: ValidatedEnv };

  if (error) {
    throw new Error(`Config validation error: ${error.message}`);
  }

  const weightGroups: Array<[string, number[]]> = [
    [
      'SCORING_WEIGHT_*',
      [
        value.SCORING_WEIGHT_ECONOMIC,
        value.SCORING_WEIGHT_ENV,
        value.SCORING_WEIGHT_SOCIAL,
      ],
    ],
    [
      'KNAPSACK_WEIGHT_*',
      [
        value.KNAPSACK_WEIGHT_UTILITY,
        value.KNAPSACK_WEIGHT_SUSTAINABILITY,
        value.KNAPSACK_WEIGHT_SAVING,
      ],
    ],
    [
      'SUBSTITUTION_WEIGHT_*',
      [
        value.SUBSTITUTION_WEIGHT_SCORE,
        value.SUBSTITUTION_WEIGHT_PRICE,
        value.SUBSTITUTION_WEIGHT_SIMILARITY,
      ],
    ],
  ];

  for (const [name, weights] of weightGroups) {
    const sum = weights.reduce((acc, w) => acc + w, 0);
    if (Math.abs(sum - 1) > 0.01) {
      throw new Error(
        `Config validation error: ${name} weights must sum to 1 (got ${sum.toFixed(3)})`,
      );
    }
  }

  return value;
}
