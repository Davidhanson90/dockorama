import type { DockoramaModel, LayoutMigrations, LayoutSource } from "./contracts.js";
import * as ops from "./ops.js";

/** The manager properties the layout store reads. */
interface StoreOptions {
  storageKey?: string;
  layoutVersion?: number;
  migrations?: LayoutMigrations;
}

/**
 * Saving, loading, upgrading and validating layouts. Problems are reported through `report`
 * (`dockorama-layoutissue`); nothing here throws.
 */
export class LayoutStore {
  /** Stored text already found unusable (reported once). */
  private unusable?: string;

  constructor(
    private readonly options: StoreOptions,
    private readonly report: (source: LayoutSource, problems: string[], fatal: boolean) => void
  ) {}

  /** Save the model under `storageKey` (when set). */
  save(model: DockoramaModel): void {
    if (!this.options.storageKey) return;
    try {
      localStorage.setItem(this.options.storageKey, JSON.stringify(model));
    } catch {
      /* storage full or disabled */
    }
  }

  /** The stored layout, upgraded and validated, with the app's views (placement comes from storage). */
  load(fallback: DockoramaModel): DockoramaModel | undefined {
    const key = this.options.storageKey;
    if (!key) return undefined;
    try {
      const raw = localStorage.getItem(key);
      if (!raw || raw === this.unusable) return undefined;
      const parsed = this.parse(raw);
      if (parsed === undefined) return undefined;
      const usable = this.prepare(ops.isModel(parsed) ? { ...parsed, views: fallback.views } : parsed, "storage");
      if (!usable) this.unusable = raw;
      return usable;
    } catch {
      return undefined;
    }
  }

  private parse(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch (err) {
      this.unusable = raw;
      this.report("storage", [`stored layout is not valid JSON: ${(err as Error).message}`], true);
      return undefined;
    }
  }

  /**
   * Check and upgrade an incoming layout: migrations to `layoutVersion`, then validation. Problems are reported with
   * `dockorama-layoutissue`; returns the normalised model, or undefined when it cannot be used.
   */
  prepare(input: unknown, source: LayoutSource): DockoramaModel | undefined {
    if (!ops.isModel(input)) {
      this.report(source, ops.validate(input), true);
      return undefined;
    }
    let model: DockoramaModel = input;
    const { layoutVersion, migrations } = this.options;
    if (layoutVersion !== undefined) {
      try {
        model = ops.upgrade(model, migrations ?? {}, layoutVersion);
      } catch (err) {
        this.report(source, [String((err as Error).message ?? err)], true);
        return undefined;
      }
    }
    const problems = ops.validate(model);
    if (problems.length) this.report(source, problems, false);
    return ops.normalize(model);
  }
}
