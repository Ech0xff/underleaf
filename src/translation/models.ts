import { providerConfig, type Settings } from "../config.ts";
import { checkHttpStatus } from "./service.ts";

export type ModelTransport = (
  url: string,
  headers: Record<string, string>,
) => Promise<{ status: number; json: unknown }>;
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};

// List endpoints are protocol APIs, independent of the selected generation model.
export async function fetchModels(
  settings: Settings,
  transport: ModelTransport,
): Promise<readonly string[]> {
  const { kind, baseURL } = providerConfig(settings.endpoint, settings.providerType);
  const headers: Record<string, string> =
    kind === "anthropic"
      ? { "x-api-key": settings.apiKey, "anthropic-version": "2023-06-01" }
      : kind === "google"
        ? { "x-goog-api-key": settings.apiKey }
        : settings.apiKey
          ? { Authorization: `Bearer ${settings.apiKey}` }
          : {};
  const ids = new Set<string>();
  const cursors = new Set<string>();
  let cursor = "";
  const deadline = Date.now() + settings.timeoutMs;
  for (let page = 0; page < 100; page++) {
    const url = new URL(`${baseURL}/models`);
    if (kind === "google") {
      url.searchParams.set("pageSize", "1000");
      if (cursor) url.searchParams.set("pageToken", cursor);
    }
    if (kind === "anthropic") {
      url.searchParams.set("limit", "1000");
      if (cursor) url.searchParams.set("after_id", cursor);
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let response: Awaited<ReturnType<ModelTransport>>;
    try {
      response = await Promise.race([
        transport(url.toString(), headers),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("timeout")),
            Math.max(0, deadline - Date.now()),
          );
        }),
      ]);
    } catch {
      throw new Error("获取模型失败，请检查网络或稍后重试。");
    } finally {
      clearTimeout(timer);
    }
    checkHttpStatus(response);
    const data = object(response.json);
    const items = kind === "google" ? data.models : data.data;
    if (!Array.isArray(items)) throw new Error("服务未返回模型列表，请手动输入模型名称。");
    for (const item of items) {
      const model = object(item);
      if (
        kind === "google" &&
        Array.isArray(model.supportedGenerationMethods) &&
        !model.supportedGenerationMethods.includes("generateContent")
      )
        continue;
      const id = kind === "google" ? model.name : model.id;
      if (typeof id === "string" && id.trim())
        ids.add(kind === "google" ? id.replace(/^models\//, "") : id.trim());
    }
    const next =
      kind === "google"
        ? data.nextPageToken
        : kind === "anthropic" && data.has_more
          ? data.last_id
          : undefined;
    if (kind === "anthropic" && data.has_more && !next)
      throw new Error("服务返回的模型分页无效，请手动输入模型名称。");
    if (!next) {
      if (!ids.size) throw new Error("没有可用模型，请手动输入模型名称。");
      return [...ids];
    }
    if (typeof next !== "string" || cursors.has(next))
      throw new Error("服务返回的模型分页无效，请手动输入模型名称。");
    cursor = next;
    cursors.add(cursor);
  }
  throw new Error("模型列表过长，请手动输入模型名称。");
}
