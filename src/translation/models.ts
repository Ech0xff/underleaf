import { createLocalizedError } from "../i18n.ts";
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
  assert(Array.isArray(items), createLocalizedError("modelsInvalid"));
  const ids = uniq(
    items
      .filter(isPlainObject)
      .filter(
        (model) =>
          kind !== "google" ||
          !Array.isArray(model.supportedGenerationMethods) ||
          model.supportedGenerationMethods.includes("generateContent"),
      )
      .map((model: Readonly<Record<string, unknown>>) =>
        kind === "google" ? model.name : model.id,
      )
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
    createLocalizedError("modelPaginationInvalid"),
  );
  assert(!next || typeof next === "string", createLocalizedError("modelPaginationInvalid"));
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
    assert(cursors.length < 100, createLocalizedError("modelsTooLong"));
    const { url, headers } = modelRequest(settings, cursor);
    const response = await withDeadline(
      () => transport(url, headers),
      Math.max(0, deadline - Date.now()),
    ).catch(() => {
      throw createLocalizedError("fetchModelsFailed");
    });
    checkHttpStatus(response);
    const page = parseModelPage(settings.providerType, response.json);
    const combined = uniq([...ids, ...page.ids]);
    if (!page.next) {
      assert(combined.length, createLocalizedError("modelsEmpty"));
      return combined;
    }
    assert(!cursors.includes(page.next), createLocalizedError("modelPaginationInvalid"));
    return readPage(page.next, [...cursors, page.next], combined);
  };
  return readPage();
};
