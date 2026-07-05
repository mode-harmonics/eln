import { loadEnv } from './load-env';
loadEnv();
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { API_PREFIX } from '@eln/shared';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({
    origin: config.get<string>('corsOrigin'),
    credentials: true,
  });

  // Increase body parser limit for file uploads (Excel workbooks can be large)
  app.useBodyParser('json', { limit: '50mb' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ELN API')
    .setDescription('Electronic Lab Notebook backend API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('port') || 3000;
  await app.listen(port);
  Logger.log(`🚀 ELN API running on http://localhost:${port}/${API_PREFIX}`, 'Bootstrap');
  Logger.log(`📚 Swagger UI at http://localhost:${port}/api/docs`, 'Bootstrap');
}

bootstrap();
