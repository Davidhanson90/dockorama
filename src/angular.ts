import {
  CUSTOM_ELEMENTS_SCHEMA, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output,
  ViewChild, type AfterViewInit, type OnChanges, type OnDestroy
} from "@angular/core";
import "./index.js";
import type { DockoramaManager } from "./engine/manager.js";
import type { ChangeReason, DockoramaLabels, DockoramaModel, DropZone, EdgeZone, LayoutMigrations, LayoutSource, ViewContent, ViewOptions } from "./core/contracts.js";
import type { TabMenuItem } from "./components/index.js";
import { applyProps, bindEvents } from "./wrappers/bridge.js";

/**
 * Angular standalone component wrapping `<dockorama-manager>`. Project view content with `data-view`:
 *
 * ```html
 * <dockorama-layout [model]="layout" (layoutChange)="save($event.model)">
 *   <div data-view="files">…</div>
 * </dockorama-layout>
 * ```
 * The underlying element is available as `element` (e.g. `@ViewChild(DockoramaLayoutComponent)`).
 */
@Component({
  selector: "dockorama-layout",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<dockorama-manager #host style="display:block;width:100%;height:100%"><ng-content></ng-content></dockorama-manager>`,
  styles: [":host { display: block; }"]
})
export class DockoramaLayoutComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() model?: DockoramaModel;
  @Input() theme?: "light" | "dark" | "auto";
  @Input() snap?: number;
  @Input() storageKey?: string;
  @Input() keepEmpty?: boolean;
  @Input() labels?: Partial<DockoramaLabels>;
  @Input() dragGroup?: string;
  @Input() tabMenu?: (viewId: string, items: TabMenuItem[]) => TabMenuItem[];
  @Input() confirmClose?: (viewId: string) => boolean | Promise<boolean>;
  @Input() layoutVersion?: number;
  @Input() retain?: "all" | "active";
  @Input() migrations?: LayoutMigrations;

  @Output() readonly layoutChange = new EventEmitter<{ model: DockoramaModel; reason: ChangeReason }>();
  @Output() readonly viewFocus = new EventEmitter<{ id: string; previous?: string }>();
  @Output() readonly viewShow = new EventEmitter<{ id: string; first: boolean }>();
  @Output() readonly beforeClose = new EventEmitter<CustomEvent<{ id: string }>>();
  @Output() readonly beforeMove = new EventEmitter<CustomEvent<{ id: string; target?: string; zone: DropZone | EdgeZone | "between" }>>();
  @Output() readonly dragCancel = new EventEmitter<{ id: string }>();
  @Output() readonly dirtyChange = new EventEmitter<{ id: string; dirty: boolean }>();
  @Output() readonly layoutIssue = new EventEmitter<{ source: LayoutSource; problems: string[]; fatal: boolean }>();
  @Output() readonly transfer = new EventEmitter<{ id: string; from: DockoramaManager; to: DockoramaManager; direction: "in" | "out" }>();

  @ViewChild("host", { static: true }) private host?: ElementRef<DockoramaManager>;
  private off?: () => void;

  /** The underlying `<dockorama-manager>` element. */
  get element(): DockoramaManager | undefined {
    return this.host?.nativeElement;
  }

  /** Add a view in one call (see `DockoramaManager.addView`). */
  addView(id: string, content: ViewContent, options?: ViewOptions): void {
    this.need().addView(id, content, options);
  }
  /** Remove a view and return its content element. */
  removeView(id: string, options?: { keepElement?: boolean }): Element | null {
    return this.need().removeView(id, options);
  }
  getViewElement(id: string): Element | null {
    return this.element?.getViewElement(id) ?? null;
  }
  hasView(id: string): boolean {
    return this.element?.hasView(id) ?? false;
  }

  private need(): DockoramaManager {
    const el = this.element;
    if (!el) throw new Error("dockorama: the layout is not initialised yet");
    return el;
  }

  ngOnChanges(): void {
    this.sync();
  }

  ngAfterViewInit(): void {
    this.sync();
    const el = this.element;
    if (!el) return;
    this.off = bindEvents(el, () => ({
      change: (d) => this.layoutChange.emit(d),
      focus: (d) => this.viewFocus.emit(d),
      viewshow: (d) => this.viewShow.emit(d),
      beforeclose: (e) => this.beforeClose.emit(e),
      beforemove: (e) => this.beforeMove.emit(e),
      dragcancel: (d) => this.dragCancel.emit(d),
      transfer: (d) => this.transfer.emit(d),
      dirty: (d) => this.dirtyChange.emit(d),
      layoutissue: (d) => this.layoutIssue.emit(d)
    }));
  }

  ngOnDestroy(): void {
    this.off?.();
  }

  private sync(): void {
    const el = this.element;
    if (el) applyProps(el, { model: this.model, theme: this.theme, snap: this.snap, storageKey: this.storageKey, keepEmpty: this.keepEmpty, labels: this.labels, dragGroup: this.dragGroup, tabMenu: this.tabMenu,
      confirmClose: this.confirmClose, layoutVersion: this.layoutVersion, migrations: this.migrations, retain: this.retain });
  }
}
