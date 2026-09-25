export type UILocale = "zh-CN" | "en";
export type UILanguage = "auto" | UILocale;
export const resolveLocale = (choice: UILanguage, obsidianLanguage: string): UILocale =>
  choice === "auto" ? (obsidianLanguage.toLowerCase().startsWith("zh") ? "zh-CN" : "en") : choice;
const english: Record<string, string> = {
  翻译失败: "Translation failed",
  "开启 / 关闭全文翻译": "Toggle document translation",
  开启全文翻译: "Enable document translation",
  关闭全文翻译: "Disable document translation",
  获取模型: "Fetch models",
  选择模型: "Choose a model",
  "获取模型失败，请检查网络或稍后重试。":
    "Could not fetch models. Check your connection or try again.",
  "服务未返回模型列表，请手动输入模型名称。":
    "This service did not return a model list. Enter the model ID manually.",
  "没有可用模型，请手动输入模型名称。": "No models available. Enter the model ID manually.",
  "服务返回的模型分页无效，请手动输入模型名称。":
    "Invalid model pagination. Enter the model ID manually.",
  "模型列表过长，请手动输入模型名称。": "Model list is too long. Enter the model ID manually.",
  自定义系统提示词: "Custom system prompt",
  "自定义系统提示词必须包含 {{ __TEXT__ }}，用于插入原文。":
    "The custom system prompt must contain {{ __TEXT__ }} to insert the source text.",
  "Underleaf 设置": "Underleaf settings",
  翻译语言: "Translation language",
  界面语言: "Interface language",
  "跟随 Obsidian": "Follow Obsidian",
  自定义: "Custom",
  自定义语言: "Custom language",
  "例如：Italiano": "For example: Italiano",
  "保存设置失败，请重试。": "Could not save settings. Please try again.",
  请求并发数: "Concurrent requests",
  "超时（秒）": "Timeout (seconds)",
  保存译文缓存: "Save translation cache",
  接口类型: "Protocol",
  "OpenAI 兼容": "OpenAI compatible",
  模型: "Model",
  连接成功: "Connection successful",
  连接失败: "Connection failed",
  测试连接: "Test connection",
  "正在测试…": "Testing…",
  "翻译 / 隐藏鼠标所在段落": "Translate / hide the paragraph under the pointer",
  正在翻译: "Translating",
  "翻译失败，请重试。": "Translation failed. Please retry.",
  "URL 必须以 https:// 或 http:// 开头，例如 https://api.example.com。":
    "URL must start with https:// or http://, for example https://api.example.com.",
  "请填写有效域名，例如 https://api.example.com。":
    "Enter a valid domain, for example https://api.example.com.",
  "URL 只接受 HTTP(S) 域名，不能包含账号、查询参数或 #。":
    "Use an HTTP(S) domain without credentials, query parameters or fragments.",
  "URL 只填域名，请去掉 /v1 等路径；插件会自动补齐接口地址。":
    "Enter only the domain. Remove paths such as /v1; the plugin adds them automatically.",
  "请填写有效的服务域名。": "Enter a valid service domain.",
  "请先填写模型名称。": "Enter a model ID first.",
  "请先填写目标语言。": "Enter a translation language first.",
  "并发数须为 1–8 的整数。": "Concurrent requests must be an integer from 1 to 8.",
  "超时须为 5–120 秒。": "Timeout must be between 5 and 120 seconds.",
  "认证失败，请检查 API Key 和模型权限。":
    "Authentication failed. Check your API key and model access.",
  "服务请求受限或额度不足，请稍后重试。": "Rate limit or quota reached. Try again later.",
  "服务报告该模型不可用。请更换模型 ID；模型列表中的名称也可能暂时无法调用。":
    "The service reports this model is unavailable. Try another model ID; listed models may be temporarily unavailable.",
  "请求超时，请检查网络或增加超时时间。":
    "Request timed out. Check your connection or increase the timeout.",
  "模型输出被截断，请更换模型或缩短段落。":
    "The model output was truncated. Use another model or shorten the paragraph.",
  "服务返回格式不兼容，请确认域名和模型支持所选协议。":
    "Incompatible response. Check that the service and model support the selected protocol.",
  "无法连接翻译服务，请检查网络、服务地址和证书。":
    "Cannot connect. Check your network, service URL and certificate.",
  "服务返回了空译文，请检查模型是否支持文字生成。":
    "The service returned an empty translation. Check that the model supports text generation.",
  "译文未完整保留代码或公式，已阻止显示。请重试或更换模型。":
    "Code or math placeholders were not preserved. Please retry or use another model.",
  已停止: "Stopped",
};
export function localize(text: string, locale: UILocale): string {
  if (locale !== "en") return text;
  if (english[text]) return english[text];
  const unavailable = /^服务暂时不可用（(\d+)）。$/.exec(text);
  if (unavailable) return `Service temporarily unavailable (${unavailable[1]}).`;
  const failed = /^请求失败（(\d+)），请检查服务地址和模型名称。$/.exec(text);
  return failed ? `Request failed (${failed[1]}). Check the service URL and model ID.` : text;
}
