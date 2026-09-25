import { isTranslatable } from "../translation/text.ts";

const candidates = "p,h1,h2,h3,h4,h5,h6,li,td,th";
const excluded =
  ".ul-translation,pre,code,.math,.math-block,mjx-container,.frontmatter,.metadata-container,.internal-embed,.markdown-embed,.dataview,.block-language-dataview,.block-language-dataviewjs,.mermaid,script,style,button";
const protectedSelector = "code,.math,mjx-container,kbd";
export type Block = Readonly<{
  element: HTMLElement;
  source: string;
  protectedNodes: readonly Element[];
  inside: boolean;
}>;

export function extractBlock(element: HTMLElement): Block {
  const protectedNodes: Element[] = [];
  const read = (node: Node): string => {
    if (node.nodeType === 3) return node.textContent ?? "";
    if (node.nodeType !== 1) return "";
    const el = node as Element;
    if (el.matches(protectedSelector)) {
      const index = protectedNodes.length;
      protectedNodes.push(el.cloneNode(true) as Element);
      return `⟪UL_KEEP_${index}⟫`;
    }
    if (
      el.matches(
        ".ul-translation,ul,ol,input,button,script,style,.internal-embed,.footnote-ref,.heading-collapse-indicator,.list-collapse-indicator",
      )
    )
      return "";
    if (el.tagName === "BR") return "\n";
    return Array.from(el.childNodes).map(read).join("");
  };
  return {
    element,
    source: Array.from(element.childNodes)
      .map(read)
      .join("")
      .replace(/[\t ]+/g, " ")
      .trim(),
    protectedNodes,
    inside: ["LI", "TD", "TH"].includes(element.tagName),
  };
}

export function collectBlocks(root: HTMLElement): readonly Block[] {
  return Array.from(root.querySelectorAll<HTMLElement>(candidates))
    .filter((el) => {
      if (el.closest(excluded)) return false;
      if (el.tagName === "P" && el.closest("td,th")) return false;
      if (el.tagName === "LI" && Array.from(el.children).some((child) => child.matches("p")))
        return false;
      return true;
    })
    .map(extractBlock)
    .filter((block) => isTranslatable(block.source));
}

export function placeTranslation(block: Block, label: string): HTMLElement {
  const el = block.element.createDiv({ cls: "ul-translation", attr: { "aria-label": label } });
  if (block.inside) {
    const list = Array.from(block.element.children).find((child) => child.matches("ul,ol"));
    block.element.insertBefore(el, list ?? null);
  } else block.element.after(el);
  return el;
}

export function displayTranslation(
  container: HTMLElement,
  text: string,
  protectedNodes: readonly Element[],
): void {
  const doc = container.ownerDocument;
  container.replaceChildren();
  const fragments = text.split(/(⟪UL_KEEP_\d+⟫)/g);
  for (const fragment of fragments) {
    const match = /^⟪UL_KEEP_(\d+)⟫$/.exec(fragment);
    const original = match ? protectedNodes[Number(match[1])] : undefined;
    container.appendChild(original ? original.cloneNode(true) : doc.createTextNode(fragment));
  }
}

// Ignore mutations caused by our own translation output.
export function isSourceMutation(mutation: MutationRecord): boolean {
  const target =
    mutation.target.nodeType === 1 ? (mutation.target as Element) : mutation.target.parentElement;
  if (target?.closest(".ul-translation")) return false;
  return (
    mutation.type === "characterData" ||
    [...mutation.addedNodes, ...mutation.removedNodes].some(
      (node) => node.nodeType !== 1 || !(node as Element).matches(".ul-translation"),
    )
  );
}
