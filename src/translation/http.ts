import { withTimeout } from "es-toolkit";

export type HttpResponse = Readonly<{ status: number; json: unknown }>;
export type Transport = (
  url: string,
  headers: Readonly<Record<string, string>>,
  body: string,
) => Promise<HttpResponse>;
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

// Cancel the deadline timer on success or failure; Obsidian cannot abort the request itself.
export async function withDeadline<T>(run: () => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  try {
    return await withTimeout(run, ms, { signal: controller.signal });
  } finally {
    controller.abort();
  }
}
