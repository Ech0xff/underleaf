import { collectBlocks, isSourceMutation } from "./dom.ts";
import type { Reader } from "./reader.ts";

export function createViewportTranslator(
  root: HTMLElement,
  reader: Reader,
  isCurrent: () => boolean,
) {
  const win = root.ownerDocument.defaultView!;
  let enabled = false;
  let intersection: IntersectionObserver | undefined;
  let mutations: MutationObserver | undefined;
  let timer: number | undefined;
  let refreshTimer: number | undefined;
  const observed = new Set<HTMLElement>();
  const visible = new Set<HTMLElement>();
  const schedule = () => {
    win.clearTimeout(timer);
    timer = win.setTimeout(() => {
      if (!enabled || !isCurrent()) return;
      for (const element of visible) if (root.contains(element)) reader.ensure(element);
    }, 150);
  };
  const refresh = () => {
    refreshTimer = undefined;
    if (!enabled || !isCurrent()) return;
    const current = new Set(collectBlocks(root).map((b) => b.element));
    for (const element of observed)
      if (!current.has(element)) {
        intersection?.unobserve(element);
        observed.delete(element);
        visible.delete(element);
      }
    for (const element of current)
      if (!observed.has(element)) {
        observed.add(element);
        intersection?.observe(element);
      }
    schedule();
  };
  const stop = () => {
    enabled = false;
    intersection?.disconnect();
    mutations?.disconnect();
    win.clearTimeout(timer);
    win.clearTimeout(refreshTimer);
    refreshTimer = undefined;
    observed.clear();
    visible.clear();
    reader.cancelAutomatic();
  };
  return {
    isEnabled: () => enabled,
    setEnabled(value: boolean) {
      if (value === enabled) return;
      if (!value) {
        stop();
        return;
      }
      if (!isCurrent()) return;
      enabled = true;
      reader.resetAutomatic();
      intersection = new win.IntersectionObserver(
        (entries) => {
          if (!enabled || !isCurrent()) return;
          for (const entry of entries) {
            const element = entry.target as HTMLElement;
            if (
              entry.isIntersecting &&
              entry.intersectionRect.height > 0 &&
              entry.intersectionRect.width > 0
            )
              visible.add(element);
            // Visibility controls admission only; queued and running work survives scrolling.
            else visible.delete(element);
          }
          schedule();
        },
        { root, rootMargin: "0px", threshold: 0 },
      );
      mutations = new win.MutationObserver((entries) => {
        const sourceChanged = entries.some(isSourceMutation);
        if (sourceChanged && !refreshTimer) refreshTimer = win.setTimeout(refresh, 80);
      });
      mutations.observe(root, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      refresh();
    },
    dispose: stop,
  };
}
export type ViewportTranslator = ReturnType<typeof createViewportTranslator>;
