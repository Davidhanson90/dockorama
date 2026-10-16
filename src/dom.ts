/** Quote a value for an attribute selector. */
export const attr = (v: string): string => JSON.stringify(v);

/** The `data-path` of a gutter or stack element as a node path. */
export const pathOf = (el: HTMLElement): number[] => (el.dataset["path"] ?? "").split(".").filter(Boolean).map(Number);

/** Every dock group (`[data-stack]`) rendered under a root. */
export const stackEls = (root: ParentNode): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>("[data-stack]"));
