/** Application-level error with an HTTP status and a stable machine code. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message = 'The request could not be processed.', details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details);

export const unauthorized = (message = 'You need to sign in to continue.') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'You do not have permission to do that.') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'We could not find what you were looking for.') =>
  new AppError(404, 'NOT_FOUND', message);

export const conflict = (message = 'That record already exists.', details?: unknown) =>
  new AppError(409, 'CONFLICT', message, details);

export const unprocessable = (message = 'Some of the submitted values are invalid.', details?: unknown) =>
  new AppError(422, 'VALIDATION_ERROR', message, details);

export const tooLarge = (message = 'That file is too large.') =>
  new AppError(413, 'PAYLOAD_TOO_LARGE', message);

export const unsupportedMedia = (message = 'That file type is not supported.') =>
  new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', message);

export const tooManyRequests = (message = 'Too many attempts. Please wait a minute and try again.') =>
  new AppError(429, 'RATE_LIMITED', message);

export const serviceUnavailable = (message = 'That service is temporarily unavailable.') =>
  new AppError(503, 'SERVICE_UNAVAILABLE', message);

export const internal = (message = 'Something went wrong on our side.') =>
  new AppError(500, 'INTERNAL_ERROR', message);
