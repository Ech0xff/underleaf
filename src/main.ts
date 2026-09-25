import { createViewportTranslator, type ViewportTranslator } from "./reading/viewport.ts";
import { localize, resolveLocale } from "./i18n.ts";
import {
  type Command,
  getLanguage,
  MarkdownView,
  normalizePath,
  Notice,
  Plugin,
  requestUrl,
} from "obsidian";
import { fetchModels } from "./translation/models.ts";
import {
  type Settings,
  validateSettings,
  type AppConfig,
  defaultConfig,
  normalizeConfig,
  validateConfig,
} from "./config.ts";
import { UnderleafSettings } from "./settings/tab.ts";
import { createReader, type Reader } from "./reading/reader.ts";
import { attachParagraphAction, type ParagraphAction } from "./reading/pointer.ts";
import { createService, type TranslationService, type Transport } from "./translation/service.ts";

type Pane = {
  view: MarkdownView;
  path: string;
  root: HTMLElement;
  reader: Reader;
  action: ParagraphAction;
  viewport: ViewportTranslator;
  fullButton: HTMLElement;
};
const transport: Transport = async (url, headers, body) => {
  const response = await requestUrl({
    url,
    headers,
    body,
    method: "POST",
    throw: false,
  });
  let json: unknown = null;
  try {
    json = JSON.parse(response.text);
  } catch {
    /* The service reports malformed responses. */
  }
  return { status: response.status, json };
};

export default class UnderleafPlugin extends Plugin {
  config: AppConfig = defaultConfig;
  get appLanguage(): string {
    return getLanguage();
  }
  get locale() {
    return resolveLocale(this.config.uiLanguage, this.appLanguage);
  }
  get runtimeSettings(): Settings {
    return { ...this.config, uiLocale: this.locale };
  }
  service!: TranslationService;
  private panes = new Map<MarkdownView, Pane>();
  private pointed?: Pane;
  private cacheTimer?: ReturnType<typeof setTimeout>;
  private writes = Promise.resolve();
  private unloaded = false;
  private paragraphCommand?: Command;
  private documentCommand?: Command;
  private lastFailureAt = 0;

  async onload() {
    this.config = normalizeConfig(await this.loadData());
    this.service = createService(transport, () => this.scheduleCacheSave());
    this.service.setConcurrency(this.config.concurrency);
    try {
      if (this.runtimeSettings.cache && (await this.app.vault.adapter.exists(this.cachePath()))) {
        const text = await this.app.vault.adapter.read(this.cachePath());
        if (text.length <= 5_000_000) this.service.load(JSON.parse(text));
      }
    } catch {
      /* A corrupt optional cache must not block reading or startup. */
    }
    this.addSettingTab(new UnderleafSettings(this));
    this.paragraphCommand = this.addCommand({
      id: "translate-paragraph",
      name: localize("翻译 / 隐藏鼠标所在段落", this.locale),
      hotkeys: [{ modifiers: ["Mod", "Alt"], key: "t" }],
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view || view.getMode() !== "preview" || !this.pointed || this.pointed.view !== view)
          return false;
        if (!checking) return this.pointed.action.trigger();
        return true;
      },
    });
    this.documentCommand = this.addCommand({
      id: "toggle-document-translation",
      name: localize("开启 / 关闭全文翻译", this.locale),
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view || view.getMode() !== "preview") return false;
        const pane = this.panes.get(view);
        if (!pane) return false;
        if (!checking) pane.fullButton.click();
        return true;
      },
    });
    this.registerEvent(this.app.workspace.on("layout-change", () => this.syncPanes()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.syncPanes()));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.syncPanes()));
    this.registerInterval(window.setInterval(() => this.syncPanes(), 500));
    this.app.workspace.onLayoutReady(() => this.syncPanes());
  }
  private notifyFailure(message: string) {
    const now = Date.now();
    if (now - this.lastFailureAt < 4000) return;
    this.lastFailureAt = now;
    new Notice(`${localize("翻译失败", this.locale)}：${message}`, 5000);
  }
  private cachePath(): string {
    return normalizePath(`${this.manifest.dir!}/cache.json`);
  }
  private scheduleCacheSave() {
    clearTimeout(this.cacheTimer);
    this.cacheTimer = setTimeout(() => {
      void this.flushCache();
    }, 500);
  }
  private flushCache(): Promise<void> {
    const value = JSON.stringify(this.runtimeSettings.cache ? this.service.dump() : []);
    this.writes = this.writes
      .catch(() => {})
      .then(() => this.app.vault.adapter.write(this.cachePath(), value))
      .catch(() => {});
    return this.writes;
  }
  private disposePane(pane: Pane) {
    pane.viewport.dispose();
    pane.fullButton.remove();
    pane.action.dispose();
    pane.reader.stop();
  }
  private clearPanes() {
    for (const pane of this.panes.values()) this.disposePane(pane);
    this.panes.clear();
    this.pointed = undefined;
  }
  async applyConfig(value: AppConfig): Promise<void> {
    validateConfig(value);
    await this.saveData(value);
    if (this.unloaded) return;
    this.clearPanes();
    const previousCache = this.service.dump();
    this.service.dispose();
    this.config = value;
    this.service = createService(transport, () => this.scheduleCacheSave());
    this.service.setConcurrency(value.concurrency);
    if (value.cache) this.service.load(previousCache);
    else await this.flushCache();
    const command = this.paragraphCommand;
    if (command)
      command.name = `${this.manifest.name}: ${localize("翻译 / 隐藏鼠标所在段落", this.locale)}`;
    if (this.documentCommand)
      this.documentCommand.name = `${this.manifest.name}: ${localize("开启 / 关闭全文翻译", this.locale)}`;
    this.syncPanes();
  }
  async fetchModels(value: Settings): Promise<readonly string[]> {
    return fetchModels(value, async (url, headers) => {
      const response = await requestUrl({
        url,
        headers,
        method: "GET",
        throw: false,
      });
      let json: unknown = null;
      try {
        json = JSON.parse(response.text);
      } catch {}
      return { status: response.status, json };
    });
  }
  async testConnection(value: Settings): Promise<string> {
    validateSettings(value);
    const isolated = createService(transport, () => {});
    try {
      return await isolated.translate(
        "Hello, world.",
        { ...value, cache: false },
        () => !this.unloaded,
      );
    } finally {
      isolated.dispose();
    }
  }
  private syncPanes() {
    if (this.unloaded) return;
    const views = new Set<MarkdownView>();
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView && leaf.view.file && leaf.view.getMode() === "preview")
        views.add(leaf.view);
    });
    for (const [view, pane] of this.panes) {
      const root = view.contentEl.querySelector<HTMLElement>(".markdown-reading-view");
      if (!views.has(view) || pane.path !== view.file?.path || root !== pane.root) {
        this.disposePane(pane);
        this.panes.delete(view);
        if (this.pointed === pane) this.pointed = undefined;
      }
    }
    for (const view of views) {
      if (this.panes.has(view)) continue;
      const root = view.contentEl.querySelector<HTMLElement>(".markdown-reading-view");
      const path = view.file!.path;
      if (!root) continue;
      const isCurrent = () =>
        !this.unloaded && view.file?.path === path && view.getMode() === "preview";
      const reader = createReader(root, this.runtimeSettings, this.service, isCurrent, (message) =>
        this.notifyFailure(message),
      );
      const pane = { view, path, root, reader } as Pane;
      pane.action = attachParagraphAction(root, reader, isCurrent, () => {
        this.pointed = pane;
      });
      pane.viewport = createViewportTranslator(root, reader, isCurrent);
      const label = () =>
        localize(pane.viewport.isEnabled() ? "关闭全文翻译" : "开启全文翻译", this.locale);
      pane.fullButton = view.addAction("languages", label(), () => {
        pane.viewport.setEnabled(!pane.viewport.isEnabled());
        pane.fullButton.classList.toggle("is-active", pane.viewport.isEnabled());
        pane.fullButton.setAttribute("aria-pressed", String(pane.viewport.isEnabled()));
        pane.fullButton.setAttribute("aria-label", label());
      });
      pane.fullButton.classList.add("ul-document-toggle");
      pane.fullButton.setAttribute("aria-pressed", "false");
      this.panes.set(view, pane);
    }
  }
  onunload() {
    this.unloaded = true;
    clearTimeout(this.cacheTimer);
    this.clearPanes();
    this.service?.dispose();
    if (this.service) void this.flushCache();
  }
}
