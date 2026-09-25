import { localize, resolveLocale, type UILanguage } from "../i18n.ts";
import { PluginSettingTab, Setting, setIcon } from "obsidian";
import type UnderleafPlugin from "../main.ts";
import { type AppConfig, normalizeConfig, officialOrigin, type ProviderType } from "../config.ts";
import { defaultPromptTemplate } from "../translation/text.ts";
import { attachModelPicker } from "./model-picker.ts";
import { createAutoSave } from "./autosave.ts";

export class UnderleafSettings extends PluginSettingTab {
  private draft!: AppConfig;
  private customTarget = false;
  private t(text: string) {
    return localize(text, resolveLocale(this.draft.uiLanguage, this.plugin.appLanguage));
  }
  private readonly autosave: ReturnType<typeof createAutoSave<AppConfig>>;
  private readonly windows = new WeakSet<Window>();
  private readonly plugin: UnderleafPlugin;
  constructor(plugin: UnderleafPlugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
    this.autosave = createAutoSave(
      (value) => plugin.applyConfig(value),
      (error) => {
        this.notify(
          error instanceof Error ? error.message : error ? "保存设置失败，请重试。" : "",
          !!error,
        );
      },
    );
    plugin.register(() => {
      void this.autosave.flush();
      this.autosave.dispose();
    });
  }
  hide() {
    void this.autosave.flush();
  }
  private notify(text: string, error = false) {
    const el = this.containerEl.querySelector<HTMLElement>(".ul-settings-feedback");
    if (el) {
      el.textContent = this.t(text);
      el.classList.toggle("ul-settings-error", error);
    }
  }
  private updateDraft(patch: Partial<AppConfig>) {
    this.draft = { ...this.draft, ...patch };
    this.notify("");
    this.autosave.schedule(this.draft);
  }
  display() {
    if (!this.draft || !this.autosave.busy()) this.draft = normalizeConfig(this.plugin.config);
    const win = this.containerEl.ownerDocument.defaultView!;
    if (!this.windows.has(win)) {
      this.windows.add(win);
      this.plugin.registerDomEvent(win, "beforeunload", () => {
        void this.autosave.flush();
      });
    }
    this.render();
  }
  private row(el: HTMLElement, name: string): Setting {
    const row = new Setting(el).setName(this.t(name)).setClass("ul-row");
    row.nameEl.addClass("ul-label");
    row.controlEl.addClass("ul-control");
    return row;
  }

  private render() {
    const el = this.containerEl;
    el.empty();
    el.addClass("ul-settings");
    new Setting(el).setName(this.t("段下译")).setHeading().setClass("ul-settings-header");
    const panel = el.createDiv({
      cls: "ul-page",
      attr: { "aria-label": this.t("段下译设置") },
    });
    const group = panel.createDiv({ cls: "ul-settings-group" });
    panel.createDiv({ cls: "ul-settings-feedback", attr: { role: "status" } });
    this.renderConnection(group);
    this.renderGeneral(group);
  }
  private renderGeneral(parent: HTMLElement) {
    let el = parent.createDiv({ cls: "ul-section" });
    const targets = [
      "简体中文",
      "繁體中文",
      "English",
      "日本語",
      "한국어",
      "Deutsch",
      "Français",
      "Español",
      "Português",
      "Русский",
      "العربية",
    ];
    const isCustom = this.customTarget || !targets.includes(this.draft.target);
    this.row(el, "翻译语言").addDropdown((d) => {
      d.selectEl.setAttribute("aria-label", this.t("翻译语言"));
      for (const target of targets) d.addOption(target, target);
      d.addOption("__custom", this.t("自定义"))
        .setValue(isCustom ? "__custom" : this.draft.target)
        .onChange((value) => {
          this.customTarget = value === "__custom";
          if (!this.customTarget) this.updateDraft({ target: value });
          this.render();
        });
    });
    if (isCustom)
      this.row(el, "自定义语言").addText((t) => {
        t.inputEl.setAttribute("aria-label", this.t("自定义语言"));
        t.setPlaceholder(this.t("例如：Italiano"))
          .setValue(this.draft.target)
          .onChange((target) => {
            this.updateDraft({ target });
            const area = this.containerEl.querySelector("textarea");
            if (area) area.placeholder = defaultPromptTemplate(this.draft);
          });
      });
    this.row(el, "界面语言").addDropdown((d) => {
      d.selectEl.setAttribute("aria-label", this.t("界面语言"));
      d.addOption("auto", this.t("跟随 Obsidian"))
        .addOption("zh-CN", "简体中文")
        .addOption("en", "English");
      d.setValue(this.draft.uiLanguage).onChange((uiLanguage) => {
        this.updateDraft({ uiLanguage: uiLanguage as UILanguage });
        this.render();
      });
    });
    const promptSection = parent.createDiv({
      cls: "ul-section",
    });
    this.row(promptSection, "自定义系统提示词").addTextArea((t) => {
      t.inputEl.setAttribute("aria-label", this.t("自定义系统提示词"));
      t.setPlaceholder(defaultPromptTemplate(this.draft))
        .setValue(this.draft.systemPromptTemplate)
        .onChange((systemPromptTemplate) => {
          this.updateDraft({ systemPromptTemplate });
        });
    });
    el = parent.createDiv({ cls: "ul-section" });
    this.row(el, "请求并发数").addText((t) => {
      t.inputEl.type = "number";
      t.inputEl.min = "1";
      t.inputEl.max = "8";
      t.inputEl.step = "1";
      t.inputEl.setAttribute("aria-label", this.t("请求并发数"));
      t.setValue(String(this.draft.concurrency)).onChange((v) => {
        this.updateDraft({ concurrency: Number(v) });
      });
    });
    this.row(el, "超时（秒）").addText((t) => {
      t.inputEl.type = "number";
      t.inputEl.min = "5";
      t.inputEl.max = "120";
      t.inputEl.setAttribute("aria-label", this.t("超时（秒）"));
      t.setValue(String(this.draft.timeoutMs / 1000)).onChange((v) => {
        this.updateDraft({ timeoutMs: Number(v) * 1000 });
      });
    });
    this.row(el, "保存译文缓存").addToggle((t) =>
      t.setValue(this.draft.cache).onChange((v) => {
        this.updateDraft({ cache: v });
      }),
    );
  }
  private renderConnection(parent: HTMLElement) {
    const el = parent.createDiv({ cls: "ul-section" });
    const provider = this.draft;
    this.row(el, "接口类型").addDropdown((d) => {
      d.selectEl.setAttribute("aria-label", this.t("接口类型"));
      d.addOption("compatible", this.t("OpenAI 兼容"))
        .addOption("anthropic", "Anthropic")
        .addOption("google", "Google Gemini");
      d.setValue(provider.providerType).onChange((type) => {
        this.updateDraft({ providerType: type as ProviderType });
        this.render();
      });
    });
    this.row(el, "URL").addText((t) => {
      t.inputEl.setAttribute("aria-label", this.t("URL"));
      t.setPlaceholder(officialOrigin(provider.providerType))
        .setValue(provider.endpoint)
        .onChange((url) => this.updateDraft({ endpoint: url }));
    });
    this.row(el, "Token").addText((t) => {
      t.inputEl.type = "password";
      t.inputEl.autocomplete = "off";
      t.inputEl.setAttribute("aria-label", this.t("Token"));
      t.setValue(provider.apiKey).onChange((token) => this.updateDraft({ apiKey: token }));
    });
    const modelRow = this.row(el, "模型");
    modelRow.addText((t) => {
      t.inputEl.setAttribute("aria-label", this.t("模型"));
      t.setPlaceholder("model-id")
        .setValue(provider.model)
        .onChange((model) => this.updateDraft({ model }));
      attachModelPicker(modelRow.controlEl, t.inputEl, {
        label: this.t("获取模型"),
        chooseLabel: this.t("选择模型"),
        fetch: () => this.plugin.fetchModels(this.draft),
        identity: () => {
          const p = this.draft;
          return JSON.stringify([p.providerType, p.endpoint, p.apiKey]);
        },
        onSelect: (model) => this.updateDraft({ model }),
        error: (message) => this.notify(message, !!message),
      });
    });
    modelRow.addButton((b) => {
      const label = this.t("测试连接");
      b.setButtonText(label);
      b.buttonEl.classList.add("ul-test-connection");
      const indicator = b.buttonEl.createSpan({
        cls: "ul-test-indicator",
        attr: { "aria-hidden": "true" },
      });
      b.buttonEl.prepend(indicator);
      indicator.hidden = true;
      const state = (value: "pending" | "success" | "error", detail: string) => {
        indicator.hidden = false;
        indicator.replaceChildren();
        indicator.className = `ul-test-indicator ul-test-${value}`;
        if (value === "pending") indicator.createSpan({ cls: "ul-spinner" });
        else setIcon(indicator, value === "success" ? "check" : "x");
        b.buttonEl.setAttribute("aria-busy", String(value === "pending"));
        b.buttonEl.setAttribute("aria-label", `${label}: ${detail}`);
        b.buttonEl.title = detail;
      };
      b.onClick(async () => {
        b.setDisabled(true);
        this.notify("");
        state("pending", this.t("正在测试…"));
        const snapshot = this.draft;
        try {
          await this.plugin.testConnection(snapshot);
          state("success", this.t("连接成功"));
        } catch (error) {
          state("error", this.t(error instanceof Error ? error.message : "连接失败"));
        } finally {
          b.setDisabled(false);
        }
      });
    });
  }
}
