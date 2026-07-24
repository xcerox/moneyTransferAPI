import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { DomainError } from '../../domain/errors';

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    traceId: string;
  };
}

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const traceId = resolveTraceId(request);
    const { statusCode, code, message } = describe(exception);

    this.logger.warn(
      { event: 'request.failed', code, statusCode, traceId },
      message,
    );
    response.status(statusCode).json(buildEnvelope(code, message, traceId));
  }
}

function describe(exception: unknown): {
  statusCode: number;
  code: string;
  message: string;
} {
  if (exception instanceof DomainError) {
    return {
      statusCode: exception.httpStatus,
      code: exception.code,
      message: exception.message,
    };
  }
  if (exception instanceof BadRequestException) {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'VALIDATION_ERROR',
      message: extractValidationMessage(exception),
    };
  }
  if (exception instanceof HttpException) {
    return {
      statusCode: exception.getStatus(),
      code: 'HTTP_ERROR',
      message: exception.message,
    };
  }
  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  };
}

function extractValidationMessage(exception: BadRequestException): string {
  const payload = exception.getResponse();
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const detail = (payload as { message: unknown }).message;
    return Array.isArray(detail) ? detail.join('; ') : String(detail);
  }
  return exception.message;
}

function resolveTraceId(request: Request): string {
  const requestWithId = request as Request & { id?: string };
  return requestWithId.id ?? 'unknown';
}

function buildEnvelope(
  code: string,
  message: string,
  traceId: string,
): ErrorEnvelope {
  return { error: { code, message, traceId } };
}
