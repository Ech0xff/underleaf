export type UILocale = "zh-CN" | "en";
export type UILanguage = "auto" | UILocale;
export const resolveLocale = (choice: UILanguage, obsidianLanguage: string): UILocale =>
  choice === "auto" ? (obsidianLanguage.toLowerCase().startsWith("zh") ? "zh-CN" : "en") : choice;

const english = {
  translationFailedTitle: "Translation failed",
  toggleDocument: "Toggle document translation",
  enableDocument: "Enable document translation",
  disableDocument: "Disable document translation",
  fetchModels: "Fetch models",
  chooseModel: "Choose a model",
  fetchModelsFailed: "Could not fetch models. Check your connection or try again.",
  modelsInvalid: "This service did not return a model list. Enter the model ID manually.",
  modelsEmpty: "No models available. Enter the model ID manually.",
  modelPaginationInvalid: "Invalid model pagination. Enter the model ID manually.",
  modelsTooLong: "Model list is too long. Enter the model ID manually.",
  customPrompt: "Custom system prompt",
  promptSourceRequired:
    "The custom system prompt must contain {{ __TEXT__ }} to insert the source text.",
  settingsLabel: "Underleaf settings",
  targetLanguage: "Translation language",
  interfaceLanguage: "Interface language",
  followObsidian: "Follow Obsidian",
  custom: "Custom",
  customLanguage: "Custom language",
  customLanguageExample: "For example: Italiano",
  saveSettingsFailed: "Could not save settings. Please try again.",
  concurrency: "Concurrent requests",
  timeoutSeconds: "Timeout (seconds)",
  cacheTranslations: "Save translation cache",
  protocol: "Protocol",
  openAICompatible: "OpenAI compatible",
  model: "Model",
  connectionSuccess: "Connection successful",
  connectionFailed: "Connection failed",
  testConnection: "Test connection",
  testingConnection: "Testing…",
  toggleParagraph: "Translate / hide the paragraph under the pointer",
  translating: "Translating",
  translationFailed: "Translation failed. Please retry.",
  urlSchemeRequired:
    "URL must start with https:// or http://, for example https://api.example.com.",
  urlInvalid: "Enter a valid domain, for example https://api.example.com.",
  urlOriginOnly: "Use an HTTP(S) domain without credentials, query parameters or fragments.",
  urlPathNotAllowed:
    "Enter only the domain. Remove paths such as /v1; the plugin adds them automatically.",
  urlHostInvalid: "Enter a valid service domain.",
  modelRequired: "Enter a model ID first.",
  targetRequired: "Enter a translation language first.",
  concurrencyInvalid: "Concurrent requests must be an integer from 1 to 8.",
  timeoutInvalid: "Timeout must be between 5 and 120 seconds.",
  authenticationFailed: "Authentication failed. Check your API key and model access.",
  rateLimited: "Rate limit or quota reached. Try again later.",
  modelUnavailable:
    "The service reports this model is unavailable. Try another model ID; listed models may be temporarily unavailable.",
  requestTimeout: "Request timed out. Check your connection or increase the timeout.",
  outputTruncated: "The model output was truncated. Use another model or shorten the paragraph.",
  responseIncompatible:
    "Incompatible response. Check that the service and model support the selected protocol.",
  networkFailed: "Cannot connect. Check your network, service URL and certificate.",
  translationEmpty:
    "The service returned an empty translation. Check that the model supports text generation.",
  placeholdersChanged:
    "Code or math placeholders were not preserved. Please retry or use another model.",
  stopped: "Stopped",
  url: "URL",
  apiToken: "API token",
  modelExample: "Model ID",
  translationLabel: "Underleaf translation",
  serviceUnavailable: "Service temporarily unavailable ({status}).",
  requestFailed: "Request failed ({status}). Check the service URL and model ID.",
  labeledStatus: "{label}: {detail}",
  pluginDirectoryMissing: "Plugin directory is unavailable.",
  providerOriginInvalid: "The provider request used an unexpected origin and was blocked.",
  providerRequestInvalid: "The provider generated an unsupported request.",
  textLimitInvalid: "Text limit must be an integer of at least 2.",
} as const;

export type MessageKey = keyof typeof english;
export type MessageParams = Readonly<Record<string, string | number>>;

const chinese: Readonly<Record<MessageKey, string>> = {
  translationFailedTitle: "翻译失败",
  toggleDocument: "开启 / 关闭全文翻译",
  enableDocument: "开启全文翻译",
  disableDocument: "关闭全文翻译",
  fetchModels: "获取模型",
  chooseModel: "选择模型",
  fetchModelsFailed: "获取模型失败，请检查网络或稍后重试。",
  modelsInvalid: "服务未返回模型列表，请手动输入模型名称。",
  modelsEmpty: "没有可用模型，请手动输入模型名称。",
  modelPaginationInvalid: "服务返回的模型分页无效，请手动输入模型名称。",
  modelsTooLong: "模型列表过长，请手动输入模型名称。",
  customPrompt: "自定义系统提示词",
  promptSourceRequired: "自定义系统提示词必须包含 {{ __TEXT__ }}，用于插入原文。",
  settingsLabel: "Underleaf 设置",
  targetLanguage: "翻译语言",
  interfaceLanguage: "界面语言",
  followObsidian: "跟随 Obsidian",
  custom: "自定义",
  customLanguage: "自定义语言",
  customLanguageExample: "例如：Italiano",
  saveSettingsFailed: "保存设置失败，请重试。",
  concurrency: "请求并发数",
  timeoutSeconds: "超时（秒）",
  cacheTranslations: "保存译文缓存",
  protocol: "接口类型",
  openAICompatible: "OpenAI 兼容",
  model: "模型",
  connectionSuccess: "连接成功",
  connectionFailed: "连接失败",
  testConnection: "测试连接",
  testingConnection: "正在测试…",
  toggleParagraph: "翻译 / 隐藏鼠标所在段落",
  translating: "正在翻译",
  translationFailed: "翻译失败，请重试。",
  urlSchemeRequired: "URL 必须以 https:// 或 http:// 开头，例如 https://api.example.com。",
  urlInvalid: "请填写有效域名，例如 https://api.example.com。",
  urlOriginOnly: "URL 只接受 HTTP(S) 域名，不能包含账号、查询参数或 #。",
  urlPathNotAllowed: "URL 只填域名，请去掉 /v1 等路径；插件会自动补齐接口地址。",
  urlHostInvalid: "请填写有效的服务域名。",
  modelRequired: "请先填写模型名称。",
  targetRequired: "请先填写目标语言。",
  concurrencyInvalid: "并发数须为 1–8 的整数。",
  timeoutInvalid: "超时须为 5–120 秒。",
  authenticationFailed: "认证失败，请检查 API Key 和模型权限。",
  rateLimited: "服务请求受限或额度不足，请稍后重试。",
  modelUnavailable: "服务报告该模型不可用。请更换模型 ID；模型列表中的名称也可能暂时无法调用。",
  requestTimeout: "请求超时，请检查网络或增加超时时间。",
  outputTruncated: "模型输出被截断，请更换模型或缩短段落。",
  responseIncompatible: "服务返回格式不兼容，请确认域名和模型支持所选协议。",
  networkFailed: "无法连接翻译服务，请检查网络、服务地址和证书。",
  translationEmpty: "服务返回了空译文，请检查模型是否支持文字生成。",
  placeholdersChanged: "译文未完整保留代码或公式，已阻止显示。请重试或更换模型。",
  stopped: "已停止",
  url: "URL",
  apiToken: "API Token",
  modelExample: "模型 ID",
  translationLabel: "Underleaf 译文",
  serviceUnavailable: "服务暂时不可用（{status}）。",
  requestFailed: "请求失败（{status}），请检查服务地址和模型名称。",
  labeledStatus: "{label}：{detail}",
  pluginDirectoryMissing: "无法找到插件目录。",
  providerOriginInvalid: "服务请求指向了非预期的域名，已阻止发送。",
  providerRequestInvalid: "服务生成了不支持的请求。",
  textLimitInvalid: "段落长度上限必须为不小于 2 的整数。",
};
const messages = { en: english, "zh-CN": chinese } as const;

export const localize = (key: MessageKey, locale: UILocale, params: MessageParams = {}): string =>
  messages[locale][key].replace(/\{(\w+)\}/g, (match, name: string) =>
    String(params[name] ?? match),
  );

const messageDetails = Symbol("underleafMessage");
export type LocalizedError = Error &
  Readonly<{
    [messageDetails]: Readonly<{ key: MessageKey; params: MessageParams }>;
  }>;

export const createLocalizedError = (key: MessageKey, params: MessageParams = {}): LocalizedError =>
  Object.assign(new Error(localize(key, "en", params)), { [messageDetails]: { key, params } });

export const isLocalizedError = (error: unknown): error is LocalizedError =>
  error instanceof Error && messageDetails in error;

export const errorMessage = (
  error: unknown,
  locale: UILocale,
  fallback: MessageKey = "translationFailed",
): string =>
  isLocalizedError(error)
    ? localize(error[messageDetails].key, locale, error[messageDetails].params)
    : localize(fallback, locale);
