import type { DockoramaModel } from "./model.js";
import { isModel } from "./ops.js";

/**
 * Named layouts ("workspaces") persisted in a Storage (localStorage by default).
 * Use with `manager.snapshot()` / `manager.restore()`.
 */
export class Workspaces {
  constructor(private readonly key: string, private readonly store: Pick<Storage, "getItem" | "setItem"> = localStorage) {}

  private read(): Record<string, DockoramaModel> {
    try {
      const v: unknown = JSON.parse(this.store.getItem(this.key) ?? "{}");
      return v && typeof v === "object" ? (v as Record<string, DockoramaModel>) : {};
    } catch {
      return {};
    }
  }

  names(): string[] {
    return Object.keys(this.read());
  }
  save(name: string, model: DockoramaModel): void {
    const all = this.read();
    all[name] = model;
    this.store.setItem(this.key, JSON.stringify(all));
  }
  load(name: string): DockoramaModel | undefined {
    const m = this.read()[name];
    return isModel(m) ? m : undefined;
  }
  remove(name: string): void {
    const all = this.read();
    delete all[name];
    this.store.setItem(this.key, JSON.stringify(all));
  }
}
