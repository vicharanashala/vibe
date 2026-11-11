import {ObjectId} from 'mongodb';

/** `T` as the client receives it: every ObjectId replaced by its hex string. */
export type WithStringIds<T> = T extends ObjectId
  ? string
  : T extends Date
    ? T
    : T extends readonly (infer U)[]
      ? WithStringIds<U>[]
      : T extends object
        ? {[K in keyof T]: WithStringIds<T[K]>}
        : T;

/**
 * Replaces every ObjectId in a response body with its hex string.
 *
 * routing-controllers passes each controller result through class-transformer's
 * instanceToPlain before JSON.stringify. A Date survives that, but an ObjectId
 * is rebuilt as a plain object, so the client receives
 * `{ buffer: { type: 'Buffer', data: [...] } }` where it expected an id. The
 * support dashboard then posted to /questions/[object Object]/respond and got a
 * 400 on every reply, and the learner widget's rate and escalate calls, which
 * reuse the questionId from the chat response, broke the same way. The
 * repositories return raw Mongo documents, so ids are converted here, on the
 * way out, rather than in every query.
 */
export function stringifyObjectIds<T>(value: T): WithStringIds<T> {
  if (value instanceof ObjectId) {
    return value.toString() as WithStringIds<T>;
  }
  if (Array.isArray(value)) {
    return value.map(item => stringifyObjectIds(item)) as WithStringIds<T>;
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, field]) => [
        key,
        stringifyObjectIds(field),
      ]),
    ) as WithStringIds<T>;
  }
  return value as WithStringIds<T>;
}

/** Mongo documents and object literals; Dates and other class instances pass through untouched. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
