import { defineComponent, h, onBeforeUnmount, onMounted, ref, toRaw, watch, type PropType } from "vue";
import "./index.js";
import type { DockoramaManager } from "./manager.js";
import type { DockoramaModel, LayoutMigrations, ViewContent, ViewOptions } from "./model.js";
import type { DockoramaLabels } from "./labels.js";
import type { TabMenuItem } from "./components/index.js";
import type { ChangeReason } from "./manager.js";
import { applyProps, bindEvents, type DockoramaHandlers } from "./bridge.js";

export type { DockoramaHandlers, DockoramaProps } from "./bridge.js";

/**
 * Vue 3 wrapper around `<dockorama-manager>`. Supports `v-model:model`.
 * Emits: `layout-change`, `update:model`, `view-focus`, `view-show`, `before-close`, `before-move`, `drag-cancel`, `transfer`, `dirty-change`, `layout-issue`.
 * Exposes `element` (the underlying `<dockorama-manager>`) plus `addView`, `removeView`, `getViewElement` and `hasView`.
 */
export const DockoramaLayout = defineComponent({
  name: "DockoramaLayout",
  props: {
    model: { type: Object as PropType<DockoramaModel>, default: undefined },
    theme: { type: String as PropType<"light" | "dark" | "auto">, default: undefined },
    snap: { type: Number, default: undefined },
    storageKey: { type: String, default: undefined },
    keepEmpty: { type: Boolean, default: undefined },
    labels: { type: Object as PropType<Partial<DockoramaLabels>>, default: undefined },
    dragGroup: { type: String, default: undefined },
    tabMenu: { type: Function as PropType<(viewId: string, items: TabMenuItem[]) => TabMenuItem[]>, default: undefined },
    confirmClose: { type: Function as PropType<(viewId: string) => boolean | Promise<boolean>>, default: undefined },
    layoutVersion: { type: Number, default: undefined },
    retain: { type: String as PropType<"all" | "active">, default: undefined },
    migrations: { type: Object as PropType<LayoutMigrations>, default: undefined }
  },
  emits: {
    "layout-change": (_d: { model: DockoramaModel; reason: ChangeReason }) => _d !== undefined,
    "update:model": (_m: DockoramaModel) => _m !== undefined,
    "view-focus": (_d: { id: string; previous?: string }) => _d !== undefined,
    "view-show": (_d: { id: string }) => _d !== undefined,
    "before-close": (_e: CustomEvent<{ id: string }>) => _e !== undefined,
    "before-move": (_e: CustomEvent) => _e !== undefined,
    "drag-cancel": (_d: { id: string }) => _d !== undefined,
    transfer: (_d: { id: string; direction: "in" | "out" }) => _d !== undefined,
    "dirty-change": (_d: { id: string; dirty: boolean }) => _d !== undefined,
    "layout-issue": (_d: { problems: string[]; fatal: boolean }) => _d !== undefined
  },
  setup(props, { emit, slots, expose }) {
    const element = ref<DockoramaManager | null>(null);
    let off: (() => void) | undefined;
    const handlers: DockoramaHandlers = {
      change: (d) => { emit("layout-change", d); emit("update:model", d.model); },
      focus: (d) => emit("view-focus", d),
      viewshow: (d) => emit("view-show", d),
      beforeclose: (e) => emit("before-close", e),
      beforemove: (e) => emit("before-move", e),
      dragcancel: (d) => emit("drag-cancel", d),
      transfer: (d) => emit("transfer", d),
      dirty: (d) => emit("dirty-change", d),
      layoutissue: (d) => emit("layout-issue", d)
    };
    // A model held in a Vue ref is a reactive proxy. Unwrap it so it compares equal to the element's own model;
    // otherwise every change event re-applies the "new" proxy, which fires another change event, forever.
    const sync = () => { if (element.value) applyProps(element.value, { ...props, model: props.model ? toRaw(props.model) : undefined }); };
    onMounted(() => {
      sync();
      if (element.value) off = bindEvents(element.value, () => handlers);
    });
    watch(() => ({ ...props }), sync, { deep: false });
    onBeforeUnmount(() => off?.());
    const need = (): DockoramaManager => {
      if (!element.value) throw new Error("dockorama: the layout is not mounted yet");
      return element.value;
    };
    expose({
      element,
      addView: (id: string, content: ViewContent, options?: ViewOptions) => need().addView(id, content, options),
      removeView: (id: string, options?: { keepElement?: boolean }) => need().removeView(id, options),
      getViewElement: (id: string) => element.value?.getViewElement(id) ?? null,
      hasView: (id: string) => element.value?.hasView(id) ?? false
    });
    return () => h("dockorama-manager", { ref: element }, slots["default"]?.());
  }
});
