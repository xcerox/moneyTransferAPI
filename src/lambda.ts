import serverlessExpress from '@codegenie/serverless-express';
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
  Handler,
} from 'aws-lambda';
import { ExpressAdapter } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import express from 'express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureSwagger } from './swagger';

let cachedHandler: Handler | undefined;

async function bootstrapHandler(): Promise<Handler> {
  const expressApp = express();
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { bufferLogs: true },
  );
  app.useLogger(app.get(Logger));
  configureSwagger(app);
  await app.init();
  return serverlessExpress({ app: expressApp });
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
  callback: Parameters<Handler>[2],
): Promise<APIGatewayProxyResult> => {
  cachedHandler = cachedHandler ?? (await bootstrapHandler());
  return cachedHandler(
    event,
    context,
    callback,
  ) as Promise<APIGatewayProxyResult>;
};
