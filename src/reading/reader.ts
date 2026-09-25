import { localize } from "../i18n.ts";
import { type Settings, validateSettings } from "../config.ts";
import {
  type Block,
  collectBlocks,
  displayTranslation,
  extractBlock,
  isSourceMutation,
  placeTranslation,
} from "./dom.ts";
import { type TranslationService } from "../translation/service.ts";

type Task = {
  automatic: boolean;
  state: "pending" | "done" | "failed";
  promise: Promise<string>;
};
type RecordState = {
  block: Block;
  signature: string;
  wrapper: HTMLElement;
  task: Task;
  automatic: boolean;
};
const signature = (block: Block): string =>
  JSON.stringify([block.source, block.protectedNodes.map((n) => n.outerHTML)]);

// Tasks belong to the reading session; records belong to the currently rendered DOM.
// Obsidian recycles offscreen nodes, so detaching a record must not cancel its task.
export function createReader(
  root: HTMLElement,
  settings: Settings,
  service: TranslationService,
  isCurrent: () => boolean,
  onFailure: (message: string) => void = () => {},
) {
  const records = new Map<HTMLElement, RecordState>();
  const tasks = new Map<string, Task>();
  let stopped = false;
  let scheduled: ReturnType<typeof setTimeout> | undefined;
  let suppressed = new WeakSet<HTMLElement>();
  const alive = () => !stopped && isCurrent();
  const validRecord = (record: RecordState) =>
    alive() &&
    records.get(record.block.element) === record &&
    root.contains(record.block.element) &&
    root.contains(record.wrapper) &&
    signature(extractBlock(record.block.element)) === record.signature;
  const hasOwner = (task: Task) => [...records.values()].some((r) => r.task === task);
  const remove = (record: RecordState) => {
    record.wrapper.remove();
    records.delete(record.block.element);
  };

  const createTask = (block: Block, automatic: boolean): Task => {
    const key = signature(block);
    const task: Task = {
      automatic,
      state: "pending",
      promise: Promise.resolve(""),
    };
    const current = () => alive() && tasks.get(key) === task;
    task.promise = Promise.resolve()
      .then(async () => {
        validateSettings(settings);
        return service.translate(block.source, settings, current);
      })
      .then(
        (text) => {
          task.state = "done";
          return text;
        },
        (error) => {
          task.state = "failed";
          if (current())
            onFailure(
              localize(
                error instanceof Error ? error.message : "翻译失败，请重试。",
                settings.uiLocale ?? "zh-CN",
              ),
            );
          throw error;
        },
      );
    tasks.set(key, task);
    return task;
  };
  const render = async (record: RecordState) => {
    record.wrapper.className = "ul-translation ul-pending";
    record.wrapper.setAttribute("aria-busy", "true");
    const spinner = root.ownerDocument.createElement("span");
    spinner.className = "ul-spinner";
    spinner.setAttribute("role", "status");
    spinner.setAttribute("aria-label", localize("正在翻译", settings.uiLocale ?? "zh-CN"));
    record.wrapper.replaceChildren(spinner);
    try {
      const text = await record.task.promise;
      if (!validRecord(record)) return;
      record.wrapper.className = "ul-translation";
      record.wrapper.removeAttribute("aria-busy");
      displayTranslation(record.wrapper, text, record.block.protectedNodes);
    } catch {
      if (validRecord(record)) remove(record);
    }
  };
  const start = (
    element: HTMLElement,
    automatic: boolean,
    block = collectBlocks(root).find((b) => b.element === element),
  ) => {
    if (!alive() || !block || (automatic && suppressed.has(element))) return;
    const existing = records.get(element);
    if (existing && validRecord(existing)) return;
    if (existing) remove(existing);
    const key = signature(block);
    let task = tasks.get(key);
    if (task?.state === "failed") {
      if (automatic) return;
      tasks.delete(key);
      task = undefined;
    }
    if (!automatic) {
      service.resetErrors();
      if (task) task.automatic = false;
    }
    task ??= createTask(block, automatic);
    const record: RecordState = {
      block,
      signature: key,
      wrapper: placeTranslation(block),
      task,
      automatic,
    };
    records.set(element, record);
    void render(record);
  };
  const prune = () => {
    scheduled = undefined;
    if (!alive()) return;
    for (const [element, record] of records)
      if (!validRecord(record)) {
        const edited =
          root.contains(element) && signature(extractBlock(element)) !== record.signature;
        remove(record);
        if (edited && !hasOwner(record.task)) tasks.delete(record.signature);
      }
    // Restore only work already requested, including manual work with auto mode off.
    for (const block of collectBlocks(root)) {
      const task = tasks.get(signature(block));
      if (task && task.state !== "failed" && !suppressed.has(block.element))
        start(block.element, task.automatic, block);
    }
  };
  const Observer = root.ownerDocument.defaultView!.MutationObserver;
  const observer = new Observer((mutations) => {
    if (mutations.some(isSourceMutation) && !scheduled) scheduled = setTimeout(prune, 30);
  });
  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  return {
    toggle: (element: HTMLElement) => {
      if (!alive()) return;
      const existing = records.get(element);
      if (existing && validRecord(existing)) {
        suppressed.add(element);
        remove(existing);
        if (!hasOwner(existing.task) && existing.task.state === "pending")
          tasks.delete(existing.signature);
        return;
      }
      suppressed.delete(element);
      start(element, false);
    },
    ensure: (element: HTMLElement) => start(element, true),
    resetAutomatic: () => {
      suppressed = new WeakSet();
      for (const [key, task] of tasks) if (task.state === "failed") tasks.delete(key);
      service.resetErrors();
    },
    cancelAutomatic: () => {
      for (const record of records.values())
        if (record.automatic && record.task.state === "pending") remove(record);
      for (const [key, task] of tasks)
        if (task.automatic && task.state === "pending" && !hasOwner(task)) tasks.delete(key);
    },
    stop: () => {
      stopped = true;
      observer.disconnect();
      clearTimeout(scheduled);
      for (const r of records.values()) r.wrapper.remove();
      records.clear();
      tasks.clear();
    },
  };
}
export type Reader = ReturnType<typeof createReader>;
