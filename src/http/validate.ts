import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { HttpError } from './http-error';

export async function validateBody<T extends object>(
  DtoClass: new () => T,
  body: unknown,
): Promise<T> {
  const instance = plainToInstance(DtoClass, body, {
    enableImplicitConversion: true,
  });
  const errors = await validate(instance as object, {
    whitelist: true,
    forbidUnknownValues: false,
  });
  if (errors.length) {
    const msg = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .filter(Boolean)
      .join('; ');
    throw new HttpError(400, msg || 'Validation failed');
  }
  return instance;
}
