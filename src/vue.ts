import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import "./index.js";
import type { FlexdockManager } from "./manager.js";
import type { FlexdockModel, ViewContent, ViewOptions } from "./model.js";
import type { FlexdockLabels } from "./labels.js";
import type { TabMenuItem } from "./components/index.js";
import type { ChangeReason } from "./manager.js";
import { applyProps, bindEvents, type FlexdockHandlers } from "./bridge.js";

export type { FlexdockHandlers, FlexdockProps } from "./bridge.js";

/**
 * Vue 3 wrapper around `<flexdock-manager>`. Supports `v-model:model`.
 * Emits: `layout-change`, `update:model`, `view-focus`, `view-show`, `before-close`, `before-move`, `drag-cancel`, `transfer`.
 * Exposes `element` (the underlying `<flexdock-manager>`) plus `addView`, `removeView`, `getViewElement` and `hasView`.
 */
export const FlexdockLayout = defineComponent({
  name: "FlexdockLayout",
  props: {
    model: { type: Object as PropType<FlexdockModel>, default: undefined },
    theme: { type: String as PropType<"light" | "dark" | "auto">, default: undefined },
    snap: { type: Number, default: undefined },
    storageKey: { type: String, default: undefined },
    keepEmpty: { type: Boolean, default: undefined },
    labels: { type: Object as PropType<Partial<FlexdockLabels>>, default: undefined },
    dragGroup: { type: String, default: undefined },
    tabMenu: { type: Function as PropType<(viewId: string, items: TabMenuItem[]) => TabMenuItem[]>, default: undefined }
  },
  emits: {
    "layout-change": (_d: { model: FlexdockModel; reason: ChangeReason }) => _d !== undefined,
    "update:model": (_m: FlexdockModel) => _m !== undefined,
    "view-focus": (_d: { id: string; previous?: string }) => _d !== undefined,
    "view-show": (_d: { id: string }) => _d !== undefined,
    "before-close": (_e: CustomEvent<{ id: string }>) => _e !== undefined,
    "before-move": (_e: CustomEvent) => _e !== undefined,
    "drag-cancel": (_d: { id: string }) => _d !== undefined,
    transfer: (_d: { id: string; direction: "in" | "out" }) => _d !== undefined
  },
  setup(props, { emit, slots, expose }) {
    const element = ref<FlexdockManager | null>(null);
    let off: (() => void) | undefined;
    const handlers: FlexdockHandlers = {
      change: (d) => { emit("layout-change", d); emit("update:model", d.model); },
      focus: (d) => emit("view-focus", d),
      viewshow: (d) => emit("view-show", d),
      beforeclose: (e) => emit("before-close", e),
      beforemove: (e) => emit("before-move", e),
      dragcancel: (d) => emit("drag-cancel", d),
      transfer: (d) => emit("transfer", d)
    };
    const sync = () => { if (element.value) applyProps(element.value, { ...props }); };
    onMounted(() => {
      sync();
      if (element.value) off = bindEvents(element.value, () => handlers);
    });
    watch(() => ({ ...props }), sync, { deep: false });
    onBeforeUnmount(() => off?.());
    const need = (): FlexdockManager => {
      if (!element.value) throw new Error("flexdock: the layout is not mounted yet");
      return element.value;
    };
    expose({
      element,
      addView: (id: string, content: ViewContent, options?: ViewOptions) => need().addView(id, content, options),
      removeView: (id: string, options?: { keepElement?: boolean }) => need().removeView(id, options),
      getViewElement: (id: string) => element.value?.getViewElement(id) ?? null,
      hasView: (id: string) => element.value?.hasView(id) ?? false
    });
    return () => h("flexdock-manager", { ref: element }, slots["default"]?.());
  }
});
