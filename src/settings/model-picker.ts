type PickerOptions = {
  label: string;
  chooseLabel: string;
  fetch: () => Promise<readonly string[]>;
  identity: () => string;
  onSelect: (value: string) => void;
  error: (error: unknown) => void;
};
export function attachModelPicker(
  parent: HTMLElement,
  input: HTMLInputElement,
  options: PickerOptions,
): void {
  parent.classList.add("ul-model-control");
  const field = parent.createDiv({ cls: "ul-model-field" });
  field.append(input);
  const toggle = field.createEl("button", {
    cls: "ul-model-toggle",
    attr: { type: "button", "aria-label": options.chooseLabel },
  });
  toggle.hidden = true;
  const list = field.createDiv({
    cls: "ul-model-options",
    attr: {
      role: "listbox",
      id: `ul-models-${crypto.randomUUID()}`,
      "aria-label": options.chooseLabel,
    },
  });
  list.hidden = true;
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", list.id);
  input.setAttribute("aria-expanded", "false");
  const fetchButton = parent.createEl("button", {
    cls: "ul-button ul-fetch-models",
    text: options.label,
    attr: { type: "button" },
  });
  let models: readonly string[] = [],
    identity = "",
    filtered: readonly string[] = [],
    active = -1;
  const close = () => {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  };
  const valid = () => {
    if (identity !== options.identity()) {
      models = [];
      toggle.hidden = true;
      close();
      return false;
    }
    return models.length > 0;
  };
  const select = (model: string) => {
    if (!valid()) return;
    input.value = model;
    options.onSelect(model);
    close();
    input.focus();
    close();
  };
  const open = (all = false) => {
    if (!valid()) return;
    filtered = models.filter((m) => all || m.toLowerCase().includes(input.value.toLowerCase()));
    list.replaceChildren();
    active = -1;
    input.removeAttribute("aria-activedescendant");
    for (const [index, model] of filtered.entries()) {
      const option = list.createDiv({
        cls: "ul-model-option",
        text: model,
        attr: {
          role: "option",
          id: `${list.id}-${index}`,
          "aria-selected": "false",
        },
      });
      option.addEventListener("mousedown", (event) => event.preventDefault());
      option.addEventListener("click", () => select(model));
    }
    list.hidden = filtered.length === 0;
    input.setAttribute("aria-expanded", String(!list.hidden));
  };
  input.addEventListener("input", () => open());
  input.addEventListener("focus", () => open(true));
  input.addEventListener("blur", close);
  toggle.addEventListener("mousedown", (event) => event.preventDefault());
  toggle.addEventListener("click", () => {
    const wasOpen = !list.hidden;
    input.focus();
    if (wasOpen) close();
    else open(true);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
      return;
    }
    if (event.key === "Enter" && !list.hidden && active >= 0) {
      event.preventDefault();
      select(filtered[active]);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (list.hidden) open(true);
    if (list.hidden) return;
    event.preventDefault();
    active = (active + (event.key === "ArrowDown" ? 1 : -1) + filtered.length) % filtered.length;
    Array.from(list.children).forEach((el, i) =>
      el.setAttribute("aria-selected", String(i === active)),
    );
    const option = list.children[active] as HTMLElement;
    input.setAttribute("aria-activedescendant", option.id);
    option.scrollIntoView?.({ block: "nearest" });
  });
  // Changing URL or token invalidates choices immediately, including an outstanding request.
  parent.closest(".ul-page")?.addEventListener("input", (event) => {
    if (event.target !== input && models.length) valid();
  });
  const loadModels = async () => {
    if (fetchButton.disabled) return;
    const snapshot = options.identity();
    fetchButton.disabled = true;
    fetchButton.setAttribute("aria-busy", "true");
    options.error(null);
    close();
    const spinner = fetchButton.createSpan({
      cls: "ul-spinner",
      attr: { "aria-hidden": "true" },
    });
    fetchButton.prepend(spinner);
    try {
      const result = await options.fetch();
      if (!input.isConnected || snapshot !== options.identity()) return;
      models = result;
      identity = snapshot;
      toggle.hidden = !models.length;
      input.focus();
      open(true);
    } catch (error) {
      if (input.isConnected && snapshot === options.identity()) options.error(error);
    } finally {
      spinner.remove();
      fetchButton.disabled = false;
      fetchButton.setAttribute("aria-busy", "false");
    }
  };
  fetchButton.addEventListener("click", () => {
    void loadModels();
  });
}
