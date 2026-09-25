import {
  errorMessage,
  localize,
  resolveLocale,
  type MessageKey,
  type UILanguage,
} from "../i18n.ts";
import { PluginSettingTab, Setting, setIcon } from "obsidian";
import type UnderleafPlugin from "../main.ts";
import { type AppConfig, normalizeConfig, officialOrigin, type ProviderType } from "../config.ts";
import { defaultPromptTemplate } from "../translation/text.ts";
import { attachModelPicker } from "./model-picker.ts";
import { createAutoSave } from "./autosave.ts";

export function createSettingsTab(plugin: UnderleafPlugin): PluginSettingTab {
  let draft = normalizeConfig(plugin.config);
  let customTarget = false;
  const windows = new WeakSet<Window>();
  const tab = new (class extends PluginSettingTab {
    display() {
      display();
    }
    hide() {
      void autosave.flush();
    }
  })(plugin.app, plugin);
  const autosave = createAutoSave<AppConfig>(
    (value) => plugin.applyConfig(value),
    (error) => notify(error ? errorMessage(error, locale(), "saveSettingsFailed") : "", !!error),
  );
  plugin.register(() => {
    void autosave.flush();
    autosave.dispose();
  });
  const locale = () => resolveLocale(draft.uiLanguage, plugin.appLanguage);
  const translateLabel = (key: MessageKey) => localize(key, locale());
  function notify(text: string, error = false) {
    const el = tab.containerEl.querySelector<HTMLElement>(".ul-settings-feedback");
    if (el) {
      el.textContent = text;
      el.classList.toggle("ul-settings-error", error);
    }
  }
  function updateDraft(patch: Partial<AppConfig>) {
    draft = { ...draft, ...patch };
    notify("");
    autosave.schedule(draft);
  }
  function display() {
    if (!autosave.busy()) draft = normalizeConfig(plugin.config);
    const win = tab.containerEl.ownerDocument.defaultView!;
    if (!windows.has(win)) {
      windows.add(win);
      plugin.registerDomEvent(win, "beforeunload", () => {
        void autosave.flush();
      });
    }
    render();
  }
  function row(el: HTMLElement, name: MessageKey): Setting {
    const row = new Setting(el).setName(translateLabel(name)).setClass("ul-row");
    row.nameEl.addClass("ul-label");
    row.controlEl.addClass("ul-control");
    return row;
  }

  function render() {
    const el = tab.containerEl;
    el.empty();
    el.addClass("ul-settings");
    new Setting(el).setName("Underleaf").setHeading().setClass("ul-settings-header");
    const panel = el.createDiv({
      cls: "ul-page",
      attr: { "aria-label": translateLabel("settingsLabel") },
    });
    const group = panel.createDiv({ cls: "ul-settings-group" });
    panel.createDiv({ cls: "ul-settings-feedback", attr: { role: "status" } });
    renderConnection(group);
    renderGeneral(group);
  }
  function renderGeneral(parent: HTMLElement) {
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
    const isCustom = customTarget || !targets.includes(draft.target);
    row(el, "targetLanguage").addDropdown((d) => {
      d.selectEl.setAttribute("aria-label", translateLabel("targetLanguage"));
      for (const target of targets) d.addOption(target, target);
      d.addOption("__custom", translateLabel("custom"))
        .setValue(isCustom ? "__custom" : draft.target)
        .onChange((value) => {
          customTarget = value === "__custom";
          if (!customTarget) updateDraft({ target: value });
          render();
        });
    });
    if (isCustom)
      row(el, "customLanguage").addText((t) => {
        t.inputEl.setAttribute("aria-label", translateLabel("customLanguage"));
        t.setPlaceholder(translateLabel("customLanguageExample"))
          .setValue(draft.target)
          .onChange((target) => {
            updateDraft({ target });
            const area = tab.containerEl.querySelector("textarea");
            if (area) area.placeholder = defaultPromptTemplate(draft);
          });
      });
    row(el, "interfaceLanguage").addDropdown((d) => {
      d.selectEl.setAttribute("aria-label", translateLabel("interfaceLanguage"));
      d.addOption("auto", translateLabel("followObsidian"))
        .addOption("zh-CN", "简体中文")
        .addOption("en", "English");
      d.setValue(draft.uiLanguage).onChange((uiLanguage) => {
        updateDraft({ uiLanguage: uiLanguage as UILanguage });
        render();
      });
    });
    const promptSection = parent.createDiv({
      cls: "ul-section",
    });
    row(promptSection, "customPrompt").addTextArea((t) => {
      t.inputEl.setAttribute("aria-label", translateLabel("customPrompt"));
      t.setPlaceholder(defaultPromptTemplate(draft))
        .setValue(draft.systemPromptTemplate)
        .onChange((systemPromptTemplate) => {
          updateDraft({ systemPromptTemplate });
        });
    });
    el = parent.createDiv({ cls: "ul-section" });
    row(el, "concurrency").addText((t) => {
      t.inputEl.type = "number";
      t.inputEl.min = "1";
      t.inputEl.max = "8";
      t.inputEl.step = "1";
      t.inputEl.setAttribute("aria-label", translateLabel("concurrency"));
      t.setValue(String(draft.concurrency)).onChange((v) => {
        updateDraft({ concurrency: Number(v) });
      });
    });
    row(el, "timeoutSeconds").addText((t) => {
      t.inputEl.type = "number";
      t.inputEl.min = "5";
      t.inputEl.max = "120";
      t.inputEl.setAttribute("aria-label", translateLabel("timeoutSeconds"));
      t.setValue(String(draft.timeoutMs / 1000)).onChange((v) => {
        updateDraft({ timeoutMs: Number(v) * 1000 });
      });
    });
    row(el, "cacheTranslations").addToggle((t) =>
      t.setValue(draft.cache).onChange((v) => {
        updateDraft({ cache: v });
      }),
    );
  }
  function renderConnection(parent: HTMLElement) {
    const el = parent.createDiv({ cls: "ul-section" });
    const provider = draft;
    row(el, "protocol").addDropdown((d) => {
      d.selectEl.setAttribute("aria-label", translateLabel("protocol"));
      d.addOption("compatible", translateLabel("openAICompatible"))
        .addOption("anthropic", "Anthropic")
        .addOption("google", "Google Gemini");
      d.setValue(provider.providerType).onChange((type) => {
        updateDraft({ providerType: type as ProviderType });
        render();
      });
    });
    row(el, "url").addText((t) => {
      t.inputEl.setAttribute("aria-label", translateLabel("url"));
      t.setPlaceholder(officialOrigin(provider.providerType))
        .setValue(provider.endpoint)
        .onChange((url) => updateDraft({ endpoint: url }));
    });
    row(el, "apiToken").addText((t) => {
      t.inputEl.type = "password";
      t.inputEl.autocomplete = "off";
      t.inputEl.setAttribute("aria-label", translateLabel("apiToken"));
      t.setValue(provider.apiKey).onChange((token) => updateDraft({ apiKey: token }));
    });
    const modelRow = row(el, "model");
    modelRow.addText((t) => {
      t.inputEl.setAttribute("aria-label", translateLabel("model"));
      t.setPlaceholder(translateLabel("modelExample"))
        .setValue(provider.model)
        .onChange((model) => updateDraft({ model }));
      attachModelPicker(modelRow.controlEl, t.inputEl, {
        label: translateLabel("fetchModels"),
        chooseLabel: translateLabel("chooseModel"),
        fetch: () => plugin.fetchModels(draft),
        identity: () => {
          const p = draft;
          return JSON.stringify([p.providerType, p.endpoint, p.apiKey]);
        },
        onSelect: (model) => updateDraft({ model }),
        error: (error) =>
          notify(error ? errorMessage(error, locale(), "fetchModelsFailed") : "", !!error),
      });
    });
    modelRow.addButton((b) => {
      const label = translateLabel("testConnection");
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
        b.buttonEl.setAttribute(
          "aria-label",
          localize("labeledStatus", locale(), { label, detail }),
        );
        b.buttonEl.title = detail;
      };
      b.onClick(async () => {
        b.setDisabled(true);
        notify("");
        state("pending", translateLabel("testingConnection"));
        const snapshot = draft;
        try {
          await plugin.testConnection(snapshot);
          state("success", translateLabel("connectionSuccess"));
        } catch (error) {
          state("error", errorMessage(error, locale(), "connectionFailed"));
        } finally {
          b.setDisabled(false);
        }
      });
    });
  }
  return tab;
}
