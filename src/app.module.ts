import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CategoryPricingModule } from './modules/category-pricing/category-pricing.module';
import { ProductsModule } from './modules/products/products.module';
import { SustainabilityModule } from './modules/sustainability/sustainability.module';
import { SubstitutionModule } from './modules/substitution/substitution.module';
import { ListsModule } from './modules/lists/lists.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { RoutesModule } from './modules/routes/routes.module';
import { PlanningModule } from './modules/planning/planning.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import type { RateLimitConfig } from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        redact: ['req.headers.authorization', 'req.body.password'],
        genReqId: (req) => req.headers['x-request-id'] ?? crypto.randomUUID(),
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const { ttl, max } = configService.get<RateLimitConfig>('rateLimit')!;
        return { throttlers: [{ ttl: ttl * 1000, limit: max }] };
      },
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    CategoryPricingModule,
    ProductsModule,
    SustainabilityModule,
    SubstitutionModule,
    ListsModule,
    DashboardModule,
    RoutesModule,
    PlanningModule,
    RewardsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
