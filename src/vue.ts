import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import "./index.js";
import type { FlexdockManager } from "./manager.js";
import type { FlexdockModel } from "./model.js";
import type { FlexdockLabels } from "./labels.js";
import type { ChangeReason } from "./manager.js";
import { applyProps, bindEvents, type FlexdockHandlers } from "./bridge.js";

export type { FlexdockHandlers, FlexdockProps } from "./bridge.js";

/**
 * Vue 3 wrapper around `<flexdock-manager>`. Supports `v-model:model`.
 * Emits: `layout-change`, `update:model`, `view-focus`, `view-show`, `before-close`, `before-move`, `drag-cancel`.
 * Exposes `element` (the underlying `<flexdock-manager>`).
 */
export const FlexdockLayout = defineComponent({
  name: "FlexdockLayout",
  props: {
    model: { type: Object as PropType<FlexdockModel>, default: undefined },
    theme: { type: String as PropType<"light" | "dark" | "auto">, default: undefined },
    snap: { type: Number, default: undefined },
    storageKey: { type: String, default: undefined },
    keepEmpty: { type: Boolean, default: undefined },
    labels: { type: Object as PropType<Partial<FlexdockLabels>>, default: undefined }
  },
  emits: {
    "layout-change": (_d: { model: FlexdockModel; reason: ChangeReason }) => _d !== undefined,
    "update:model": (_m: FlexdockModel) => _m !== undefined,
    "view-focus": (_d: { id: string; previous?: string }) => _d !== undefined,
    "view-show": (_d: { id: string }) => _d !== undefined,
    "before-close": (_e: CustomEvent<{ id: string }>) => _e !== undefined,
    "before-move": (_e: CustomEvent) => _e !== undefined,
    "drag-cancel": (_d: { id: string }) => _d !== undefined
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
      dragcancel: (d) => emit("drag-cancel", d)
    };
    const sync = () => { if (element.value) applyProps(element.value, { ...props }); };
    onMounted(() => {
      sync();
      if (element.value) off = bindEvents(element.value, () => handlers);
    });
    watch(() => ({ ...props }), sync, { deep: false });
    onBeforeUnmount(() => off?.());
    expose({ element });
    return () => h("flexdock-manager", { ref: element }, slots["default"]?.());
  }
});
