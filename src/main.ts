import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  // Render sits in front of the app as a single reverse-proxy hop; trust
  // exactly that hop so Express's req.ip (and @nestjs/throttler's default
  // tracker, which reads req.ip) resolves to the real client IP instead of
  // Render's proxy IP for every request. Do NOT use `true`/'*', which would
  // trust an attacker-supplied X-Forwarded-For from arbitrary hops.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  const configService = app.get(ConfigService);
  const { port, corsOrigin } = configService.get<AppConfig>('app')!;

  app.use(
    helmet({
      // Helmet's default Cross-Origin-Resource-Policy is `same-origin`,
      // which blocks a separately-hosted frontend from fetching this API
      // in-browser even when CORS (below) is configured correctly.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.enableCors({ origin: corsOrigin });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('LiquiVerde API')
    .setDescription(
      'Retail inteligente para ahorro y consumo sostenible — Test Técnico Software Engineer I, Grupo Lagos',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
}

bootstrap().catch((error: unknown) => {
  console.error('Fatal error during bootstrap', error);
  process.exit(1);
});
