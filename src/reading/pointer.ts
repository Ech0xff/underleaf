import { collectBlocks } from "./dom.ts";
import { type Reader } from "./reader.ts";

// Track the pointer for the keyboard command without adding anything to the note.
export function attachParagraphAction(
  root: HTMLElement,
  reader: Reader,
  isCurrent: () => boolean,
  onPoint: () => void,
) {
  const doc = root.ownerDocument;
  const win = doc.defaultView!;
  let disposed = false;
  let pointer: { x: number; y: number } | undefined;
  const move = (event: PointerEvent) => {
    pointer = { x: event.clientX, y: event.clientY };
    onPoint();
  };
  const leave = () => {
    pointer = undefined;
  };
  root.addEventListener("pointermove", move);
  root.addEventListener("pointerleave", leave);
  win.addEventListener("blur", leave);
  return {
    trigger: () => {
      if (disposed || !isCurrent() || !pointer) return false;
      // Resolve against the current layout, including after scrolling or re-rendering.
      const target = doc.elementFromPoint(pointer.x, pointer.y);
      if (!target || !root.contains(target) || target.closest(".ul-translation")) return false;
      const blocks = collectBlocks(root);
      const block =
        blocks.find((b) => b.element === target) ??
        [...blocks].reverse().find((b) => b.element.contains(target));
      if (!block) return false;
      reader.toggle(block.element);
      return true;
    },
    dispose: () => {
      disposed = true;
      pointer = undefined;
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerleave", leave);
      win.removeEventListener("blur", leave);
    },
  };
}
export type ParagraphAction = ReturnType<typeof attachParagraphAction>;
