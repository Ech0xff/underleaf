import { APICallError } from "ai";
import { defaultConfig, type Settings } from "../config.ts";
import { cacheIdentity, digest, splitText, validateTranslation } from "./text.ts";
import { createSdkGenerator } from "./sdk.ts";

export type HttpResponse = Readonly<{ status: number; json: unknown }>;
export type Transport = (
  url: string,
  headers: Record<string, string>,
  body: string,
) => Promise<HttpResponse>;
export type CacheEntry = Readonly<{ key: string; text: string }>;
export class TranslationError extends Error {
  readonly retryable: boolean;
  readonly fatal: boolean;
  constructor(message: string, retryable = false, fatal = false) {
    super(message);
    this.retryable = retryable;
    this.fatal = fatal;
  }
}

export function checkHttpStatus(response: HttpResponse): void {
  if (response.status === 401 || response.status === 403)
    throw new TranslationError("认证失败，请检查 API Key 和模型权限。", false, true);
  if (response.status === 429)
    throw new TranslationError("服务请求受限或额度不足，请稍后重试。", true);
  if (response.status >= 500)
    throw new TranslationError(`服务暂时不可用（${response.status}）。`, true);
  if (response.status === 404 || response.status === 400) {
    const errorBody = response.json as { error?: { message?: unknown } } | null;
    if (
      typeof errorBody?.error?.message === "string" &&
      /model.{0,150}(not available|not found|does not exist|unavailable)/i.test(
        errorBody.error.message,
      )
    ) {
      throw new TranslationError(
        "服务报告该模型不可用。请更换模型 ID；模型列表中的名称也可能暂时无法调用。",
        false,
        true,
      );
    }
  }
  if (response.status < 200 || response.status >= 300)
    throw new TranslationError(
      `请求失败（${response.status}），请检查服务地址和模型名称。`,
      false,
      response.status === 404,
    );
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new TranslationError("请求超时，请检查网络或增加超时时间。")),
          ms,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

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
        job.reject(new Error("已停止"));
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
          if (error instanceof TranslationError && error.fatal) fatal = error;
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
    for (let attempt = 0; ; attempt++) {
      if (disposed || !alive()) throw new Error("已停止");
      try {
        const result = await withTimeout(generate(source, settings), settings.timeoutMs);
        if (result.truncated) throw new TranslationError("模型输出被截断，请更换模型或缩短段落。");
        return validateTranslation(source, result.text);
      } catch (error) {
        if (error instanceof TranslationError && error.retryable && attempt < 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          continue;
        }
        // Do not show server bodies or transport errors that may contain sensitive headers.
        if (error instanceof TranslationError) throw error;
        if (error instanceof Error && /代码或公式|空译文/.test(error.message)) throw error;
        if (APICallError.isInstance(error) && error.statusCode === 200)
          throw new TranslationError("服务返回格式不兼容，请确认域名和模型支持所选协议。");
        throw new TranslationError("无法连接翻译服务，请检查网络、服务地址和证书。");
      }
    }
  };

  const translate = async (
    source: string,
    settings: Settings,
    alive: () => boolean,
  ): Promise<string> => {
    const key = await digest(cacheIdentity(settings, source));
    if (!alive() || disposed) throw new Error("已停止");
    if (settings.cache && cache.has(key)) return cache.get(key)!.text;
    // Completed/active requests are shared only through cache; each view owns its pending tasks.
    return enqueue(async () => {
      if (settings.cache && cache.has(key)) return cache.get(key)!.text;
      const pieces: string[] = [];
      for (const part of splitText(source)) pieces.push(await request(part, settings, alive));
      const value = validateTranslation(source, pieces.join("\n"));
      if (!disposed && alive() && settings.cache) {
        cache.delete(key);
        cache.set(key, { key, text: value });
        let size = [...cache.values()].reduce((sum, e) => sum + e.text.length, 0);
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
      concurrency = Math.max(1, Math.min(8, Math.round(value)));
      pump();
    },
    resetErrors: () => {
      fatal = null;
    },
    dump: (): readonly CacheEntry[] => [...cache.values()],
    load: (entries: unknown) => {
      if (!Array.isArray(entries)) return;
      for (const e of entries.slice(-1000)) {
        if (
          e &&
          typeof e.key === "string" &&
          /^[a-f0-9]{64}$/.test(e.key) &&
          typeof e.text === "string" &&
          e.text.length <= 50000
        )
          cache.set(e.key, { key: e.key, text: e.text });
      }
    },
    dispose: () => {
      disposed = true;
      pending.splice(0).forEach((job) => job.reject(new Error("已停止")));
    },
  };
}
export type TranslationService = ReturnType<typeof createService>;
