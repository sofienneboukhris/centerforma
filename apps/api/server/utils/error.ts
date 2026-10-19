import { createError as h3CreateError } from "h3";

export type ApiErrorOptions = {
  statusCode: number;
  message?: string;
  statusMessage?: string;
  data?: any;
};

/**
 * Normalise les erreurs pour être à la fois compatibles avec Vitest (statusCode)
 * et le runtime serveur Nitro v3 / H3 v2 (name: "HTTPError", status, message, statusMessage).
 */
export function createApiError(opts: ApiErrorOptions): Error {
  const msg = opts.message || opts.statusMessage || "Error";
  const err = h3CreateError({
    statusCode: opts.statusCode,
    statusMessage: msg,
    message: msg,
    data: opts.data,
  }) as any;
  err.name = "HTTPError";
  err.status = opts.statusCode;
  err.statusCode = opts.statusCode;
  err.message = msg;
  err.statusMessage = msg;
  return err;
}

export { createApiError as createError };
