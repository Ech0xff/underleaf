import { assert, isPlainObject, uniq } from "es-toolkit";
import { providerConfig, type ProviderType, type Settings } from "../config.ts";
import { checkHttpStatus, withDeadline, type HttpResponse } from "./http.ts";

export type ModelTransport = (
  url: string,
  headers: Readonly<Record<string, string>>,
) => Promise<HttpResponse>;
type ModelPage = Readonly<{ ids: readonly string[]; next: string | undefined }>;

export const parseModelPage = (kind: ProviderType, payload: unknown): ModelPage => {
  const data: Readonly<Record<string, unknown>> = isPlainObject(payload) ? payload : {};
  const items = kind === "google" ? data.models : data.data;
  assert(Array.isArray(items), "服务未返回模型列表，请手动输入模型名称。");
  const ids = uniq(
    items
      .filter(isPlainObject)
      .filter(
        (model) =>
          kind !== "google" ||
          !Array.isArray(model.supportedGenerationMethods) ||
          model.supportedGenerationMethods.includes("generateContent"),
      )
      .map((model) => (kind === "google" ? model.name : model.id))
      .filter((id): id is string => typeof id === "string" && !!id.trim())
      .map((id) => (kind === "google" ? id.trim().replace(/^models\//, "") : id.trim()))
      .filter(Boolean),
  );
  const next =
    kind === "google"
      ? data.nextPageToken
      : kind === "anthropic" && data.has_more
        ? data.last_id
        : undefined;
  assert(
    kind !== "anthropic" || !data.has_more || !!next,
    "服务返回的模型分页无效，请手动输入模型名称。",
  );
  assert(!next || typeof next === "string", "服务返回的模型分页无效，请手动输入模型名称。");
  return { ids, next: typeof next === "string" && next ? next : undefined };
};

// Request construction and response parsing stay separate from network effects.
const modelRequest = (settings: Settings, cursor: string) => {
  const { kind, baseURL } = providerConfig(settings.endpoint, settings.providerType);
  const headers: Readonly<Record<string, string>> =
    kind === "anthropic"
      ? { "x-api-key": settings.apiKey, "anthropic-version": "2023-06-01" }
      : kind === "google"
        ? { "x-goog-api-key": settings.apiKey }
        : settings.apiKey
          ? { Authorization: `Bearer ${settings.apiKey}` }
          : {};
  const params: Record<string, string> =
    kind === "google"
      ? { pageSize: "1000", ...(cursor ? { pageToken: cursor } : {}) }
      : kind === "anthropic"
        ? { limit: "1000", ...(cursor ? { after_id: cursor } : {}) }
        : {};
  const query = new URLSearchParams(params).toString();
  return { url: `${baseURL}/models${query ? `?${query}` : ""}`, headers };
};

export const fetchModels = async (
  settings: Settings,
  transport: ModelTransport,
): Promise<readonly string[]> => {
  const deadline = Date.now() + settings.timeoutMs;
  const readPage = async (
    cursor = "",
    cursors: readonly string[] = [],
    ids: readonly string[] = [],
  ): Promise<readonly string[]> => {
    assert(cursors.length < 100, "模型列表过长，请手动输入模型名称。");
    const { url, headers } = modelRequest(settings, cursor);
    const response = await withDeadline(
      () => transport(url, headers),
      Math.max(0, deadline - Date.now()),
    ).catch(() => {
      throw new Error("获取模型失败，请检查网络或稍后重试。");
    });
    checkHttpStatus(response);
    const page = parseModelPage(settings.providerType, response.json);
    const combined = uniq([...ids, ...page.ids]);
    if (!page.next) {
      assert(combined.length, "没有可用模型，请手动输入模型名称。");
      return combined;
    }
    assert(!cursors.includes(page.next), "服务返回的模型分页无效，请手动输入模型名称。");
    return readPage(page.next, [...cursors, page.next], combined);
  };
  return readPage();
};
