import { HttpError } from './http-error';

export function parseIntParam(value: string | undefined, name: string): number {
  if (value === undefined || value === '') {
    throw new HttpError(400, `Missing ${name}`);
  }
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n) || n < 1) {
    throw new HttpError(400, `Invalid ${name}`);
  }
  return n;
}
