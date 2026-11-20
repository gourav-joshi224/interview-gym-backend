import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { validateEnv } from './config/env.config';

async function bootstrap() {
  if (process.env.NODE_ENV !== 'test') {
    validateEnv();
  }
  const app = await NestFactory.create(AppModule);
  if (process.env.TRUST_PROXY) {
    // Needed behind a load balancer so rate limiting sees the real client IP.
    app.getHttpAdapter().getInstance().set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
  }
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const corsOrigin = configService.get<string>('cors.origin', '*');
  const normalizeOrigin = (value: string) => value.trim().replace(/\/$/, '');
  const allowedOrigins = corsOrigin
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);
  const allowAllOrigins = allowedOrigins.includes('*');

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowAllOrigins) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = normalizeOrigin(origin);
      if (allowedOrigins.includes(normalizedOrigin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      stopAtFirstError: true,
    }),
  );

  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Interview Gym API')
      .setVersion('2.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api-docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  const port = configService.get<number>('port', 3001);
  const host = configService.get<string>('host', '127.0.0.1');
  await app.listen(port, host);
  logger.log(`Nest backend listening on http://${host}:${port}`);
}

void bootstrap();
