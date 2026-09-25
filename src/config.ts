import { assert, attempt, clamp, isPlainObject } from "es-toolkit";
import type { UILanguage, UILocale } from "./i18n.ts";

export type Settings = Readonly<{
  endpoint: string;
  apiKey: string;
  model: string;
  target: string;
  instructions: string;
  systemPromptTemplate: string;
  cache: boolean;
  timeoutMs: number;
  providerType: ProviderType;
  uiLocale?: UILocale;
}>;
export type ProviderType = "compatible" | "anthropic" | "google";

export const defaults: Settings = {
  endpoint: "",
  apiKey: "",
  model: "",
  target: "简体中文",
  instructions: "",
  systemPromptTemplate: "",
  cache: true,
  timeoutMs: 45000,
  providerType: "compatible",
};

const normalizeSettings = (value: Record<string, unknown>): Settings => ({
  endpoint: typeof value.endpoint === "string" ? value.endpoint.trim() : "",
  apiKey: typeof value.apiKey === "string" ? value.apiKey.trim() : "",
  model: typeof value.model === "string" ? value.model.trim() : "",
  target:
    typeof value.target === "string" && value.target.trim() ? value.target.trim() : defaults.target,
  instructions: typeof value.instructions === "string" ? value.instructions.trim() : "",
  systemPromptTemplate:
    typeof value.systemPromptTemplate === "string" ? value.systemPromptTemplate.trim() : "",
  cache: typeof value.cache === "boolean" ? value.cache : true,
  timeoutMs:
    typeof value.timeoutMs === "number" && Number.isFinite(value.timeoutMs)
      ? clamp(value.timeoutMs, 5000, 120000)
      : 45000,
  providerType:
    value.providerType === "anthropic" || value.providerType === "google"
      ? value.providerType
      : "compatible",
});

export function serviceOrigin(input: string): string {
  const value = input.trim();
  assert(
    /^https?:\/\//i.test(value),
    "URL 必须以 https:// 或 http:// 开头，例如 https://api.example.com。",
  );
  const [, url] = attempt(() => new URL(value));
  assert(url, "请填写有效域名，例如 https://api.example.com。");
  assert(
    ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash,
    "URL 只接受 HTTP(S) 域名，不能包含账号、查询参数或 #。",
  );
  assert(url.pathname === "/", "URL 只填域名，请去掉 /v1 等路径；插件会自动补齐接口地址。");
  assert(
    url.hostname.includes(".") || url.hostname.includes(":") || url.hostname === "localhost",
    "请填写有效的服务域名。",
  );
  return url.origin;
}

export const officialOrigin = (kind: ProviderType): string =>
  ({
    compatible: "https://api.openai.com",
    anthropic: "https://api.anthropic.com",
    google: "https://generativelanguage.googleapis.com",
  })[kind];

export function providerConfig(
  input: string,
  kind: ProviderType = "compatible",
): Readonly<{ kind: ProviderType; baseURL: string }> {
  const origin = serviceOrigin(input.trim() || officialOrigin(kind));
  return { kind, baseURL: `${origin}/${kind === "google" ? "v1beta" : "v1"}` };
}

export function validateSettings(settings: Settings): void {
  providerConfig(settings.endpoint, settings.providerType);
  assert(settings.model, "请先填写模型名称。");
  assert(settings.target, "请先填写目标语言。");
  validatePromptTemplate(settings.systemPromptTemplate);
}

export function validatePromptTemplate(template: string): void {
  assert(
    !template.trim() || /\{\{\s*__TEXT__\s*\}\}/.test(template),
    "自定义系统提示词必须包含 {{ __TEXT__ }}，用于插入原文。",
  );
}

export type AppConfig = Settings &
  Readonly<{
    version: 5;
    concurrency: number;
    uiLanguage: UILanguage;
  }>;

export const defaultConfig: AppConfig = {
  ...defaults,
  version: 5,
  concurrency: 5,
  uiLanguage: "auto",
};

export function normalizeConfig(input: unknown): AppConfig {
  const raw: Readonly<Record<string, unknown>> = isPlainObject(input) ? input : {};
  const providers = Array.isArray(raw.providers) ? raw.providers.filter(isPlainObject) : [];
  const provider = providers.find((p) => p.id === raw.activeProviderId) ?? providers[0];
  const settings = normalizeSettings(
    provider
      ? {
          ...raw,
          endpoint: provider.url,
          apiKey: provider.token,
          model: provider.model,
          providerType: provider.type,
        }
      : raw,
  );

  // Only the earliest flat format accepted full API paths.
  const migrateEndpoint = !provider && raw.version !== 5 && raw.domainOnlyVersion !== 1;
  const endpoint = migrateEndpoint
    ? (attempt(() => new URL(settings.endpoint).origin)[1] ?? settings.endpoint)
    : settings.endpoint;

  return {
    ...settings,
    version: 5,
    endpoint,
    concurrency:
      typeof raw.concurrency === "number" && Number.isFinite(raw.concurrency)
        ? clamp(Math.round(raw.concurrency), 1, 8)
        : defaultConfig.concurrency,
    uiLanguage: raw.uiLanguage === "en" || raw.uiLanguage === "zh-CN" ? raw.uiLanguage : "auto",
    systemPromptTemplate: settings.systemPromptTemplate.replace(
      /\{\{\s*__TEXT__\s*\}\}|\*\*TEXT\*\*|__TEXT__/g,
      () => "{{ __TEXT__ }}",
    ),
  };
}

export function validateConfig(config: AppConfig): void {
  assert(
    Number.isInteger(config.concurrency) && config.concurrency >= 1 && config.concurrency <= 8,
    "并发数须为 1–8 的整数。",
  );
  assert(
    Number.isFinite(config.timeoutMs) && config.timeoutMs >= 5000 && config.timeoutMs <= 120000,
    "超时须为 5–120 秒。",
  );
  if (config.endpoint) serviceOrigin(config.endpoint);
  assert(config.target.trim(), "请先填写目标语言。");
  validatePromptTemplate(config.systemPromptTemplate);
}
