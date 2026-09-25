import { assert, withTimeout } from "es-toolkit";
import {
  createLocalizedError,
  isLocalizedError,
  type LocalizedError,
  type MessageKey,
  type MessageParams,
} from "../i18n.ts";

export type HttpResponse = Readonly<{ status: number; json: unknown }>;
export type Transport = (
  url: string,
  headers: Readonly<Record<string, string>>,
  body: string,
) => Promise<HttpResponse>;
export type TranslationError = LocalizedError & Readonly<{ retryable: boolean; fatal: boolean }>;
export const translationError = (
  key: MessageKey,
  retryable = false,
  fatal = false,
  params: MessageParams = {},
): TranslationError => Object.assign(createLocalizedError(key, params), { retryable, fatal });
export const isTranslationError = (error: unknown): error is TranslationError =>
  isLocalizedError(error) &&
  "retryable" in error &&
  typeof error.retryable === "boolean" &&
  "fatal" in error &&
  typeof error.fatal === "boolean";

export function checkHttpStatus(response: HttpResponse): void {
  assert(
    response.status !== 401 && response.status !== 403,
    translationError("authenticationFailed", false, true),
  );
  assert(response.status !== 429, translationError("rateLimited", true));
  assert(
    response.status < 500,
    translationError("serviceUnavailable", true, false, { status: response.status }),
  );
  if (response.status === 404 || response.status === 400) {
    const errorBody = response.json as { error?: { message?: unknown } } | null;
    const modelUnavailable =
      typeof errorBody?.error?.message === "string" &&
      /model.{0,150}(not available|not found|does not exist|unavailable)/i.test(
        errorBody.error.message,
      );
    assert(!modelUnavailable, translationError("modelUnavailable", false, true));
  }
  assert(
    response.status >= 200 && response.status < 300,
    translationError("requestFailed", false, response.status === 404, { status: response.status }),
  );
}

// Cancel the deadline timer on success or failure; Obsidian cannot abort the request itself.
export async function withDeadline<T>(run: () => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  try {
    return await withTimeout(run, ms, { signal: controller.signal });
  } finally {
    controller.abort();
  }
}
