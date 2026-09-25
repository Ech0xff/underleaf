import { createLocalizedError, isLocalizedError } from "../i18n.ts";
import { assert, clamp, isPlainObject, reduceAsync, retry, sumBy, TimeoutError } from "es-toolkit";
import {
  checkHttpStatus,
  translationError,
  isTranslationError,
  withDeadline,
  type TranslationError,
  type Transport,
} from "./http.ts";
import { APICallError } from "ai";
import { defaultConfig, type Settings } from "../config.ts";
import { cacheIdentity, digest, splitText, validateTranslation } from "./text.ts";
import { createSdkGenerator } from "./sdk.ts";

export type CacheEntry = Readonly<{ key: string; text: string }>;

export function createService(transport: Transport, onCacheChanged: () => void) {
  const generate = createSdkGenerator(async (url, headers, body) => {
    const response = await transport(url, headers, body);
    checkHttpStatus(response);
    return response;
  });
  const cache = new Map<string, CacheEntry>();
  const pending: {
    run: () => Promise<string>;
    resolve: (value: string) => void;
    reject: (error: unknown) => void;
    alive: () => boolean;
  }[] = [];
  let active = 0;
  let disposed = false;
  let fatal: TranslationError | null = null;
  let concurrency = defaultConfig.concurrency;

  const pump = () => {
    while (active < concurrency && pending.length) {
      const job = pending.shift()!;
      if (disposed || !job.alive()) {
        job.reject(createLocalizedError("stopped"));
        continue;
      }
      if (fatal) {
        job.reject(fatal);
        continue;
      }
      active++;
      void job
        .run()
        .then(job.resolve, (error) => {
          if (isTranslationError(error) && error.fatal) fatal = error;
          job.reject(error);
        })
        .finally(() => {
          active--;
          pump();
        });
    }
  };
  const enqueue = (run: () => Promise<string>, alive: () => boolean) =>
    new Promise<string>((resolve, reject) => {
      pending.push({ run, resolve, reject, alive });
      pump();
    });

  const request = async (
    source: string,
    settings: Settings,
    alive: () => boolean,
  ): Promise<string> => {
    try {
      return await retry(
        async () => {
          assert(!disposed && alive(), translationError("stopped"));
          const result = await withDeadline(() => generate(source, settings), settings.timeoutMs);
          assert(!result.truncated, translationError("outputTruncated"));
          return validateTranslation(source, result.text);
        },
        {
          retries: 1,
          delay: 1500,
          shouldRetry: (error) => isTranslationError(error) && error.retryable,
        },
      );
    } catch (error) {
      // Do not show server bodies or transport errors that may contain sensitive headers.
      if (isTranslationError(error)) throw error;
      if (error instanceof TimeoutError) throw translationError("requestTimeout");
      if (isLocalizedError(error)) throw error;
      if (APICallError.isInstance(error) && error.statusCode === 200)
        throw translationError("responseIncompatible");
      throw translationError("networkFailed");
    }
  };

  const translate = async (
    source: string,
    settings: Settings,
    alive: () => boolean,
  ): Promise<string> => {
    const key = await digest(cacheIdentity(settings, source));
    if (!alive() || disposed) throw createLocalizedError("stopped");
    if (settings.cache && cache.has(key)) return cache.get(key)!.text;
    // Completed/active requests are shared only through cache; each view owns its pending tasks.
    return enqueue(async () => {
      if (settings.cache && cache.has(key)) return cache.get(key)!.text;
      const combined = await reduceAsync(
        splitText(source),
        async (output, part) => {
          const text = await request(part, settings, alive);
          return output ? `${output}\n${text}` : text;
        },
        "",
      );
      const value = validateTranslation(source, combined);
      if (!disposed && alive() && settings.cache) {
        cache.delete(key);
        cache.set(key, { key, text: value });
        let size = sumBy([...cache.values()], (entry) => entry.text.length);
        while (cache.size > 1000 || size > 2_000_000) {
          const oldest = cache.keys().next().value!;
          size -= cache.get(oldest)!.text.length;
          cache.delete(oldest);
        }
        onCacheChanged();
      }
      return value;
    }, alive);
  };
  return {
    translate,
    setConcurrency: (value: number) => {
      concurrency = clamp(Math.round(value), 1, 8);
      pump();
    },
    resetErrors: () => {
      fatal = null;
    },
    dump: (): readonly CacheEntry[] => [...cache.values()],
    load: (entries: unknown) => {
      if (!Array.isArray(entries)) return;
      entries
        .slice(-1000)
        .filter(
          (entry: unknown): entry is CacheEntry =>
            isPlainObject(entry) &&
            typeof entry.key === "string" &&
            /^[a-f0-9]{64}$/.test(entry.key) &&
            typeof entry.text === "string" &&
            entry.text.length <= 50000,
        )
        .forEach(({ key, text }) => cache.set(key, { key, text }));
    },
    dispose: () => {
      disposed = true;
      pending.splice(0).forEach((job) => job.reject(createLocalizedError("stopped")));
    },
  };
}
export type TranslationService = ReturnType<typeof createService>;
