import { createElement, forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties, type ReactNode } from "react";
import "./index.js";
import type { FlexdockManager } from "./manager.js";
import { applyProps, bindEvents, type FlexdockHandlers, type FlexdockProps } from "./bridge.js";

export type { FlexdockHandlers, FlexdockProps } from "./bridge.js";

/** Props of `<FlexdockLayout>`: element properties plus `on*` callbacks. */
export interface FlexdockLayoutProps extends FlexdockProps {
  className?: string;
  style?: CSSProperties;
  id?: string;
  /** Children with `data-view="<id>"` become the views' content. */
  children?: ReactNode;
  onLayoutChange?: FlexdockHandlers["change"];
  onViewFocus?: FlexdockHandlers["focus"];
  onViewShow?: FlexdockHandlers["viewshow"];
  onBeforeClose?: FlexdockHandlers["beforeclose"];
  onBeforeMove?: FlexdockHandlers["beforemove"];
  onDragCancel?: FlexdockHandlers["dragcancel"];
}

function handlersOf(p: FlexdockLayoutProps): FlexdockHandlers {
  return {
    change: p.onLayoutChange, focus: p.onViewFocus, viewshow: p.onViewShow,
    beforeclose: p.onBeforeClose, beforemove: p.onBeforeMove, dragcancel: p.onDragCancel
  };
}

/** React wrapper around `<flexdock-manager>`. The ref gives you the element (methods like `undo()`). */
export const FlexdockLayout = forwardRef<FlexdockManager | null, FlexdockLayoutProps>(function FlexdockLayout(props, ref) {
  const el = useRef<FlexdockManager | null>(null);
  const latest = useRef(props);
  latest.current = props;
  useImperativeHandle(ref, () => el.current!, []);
  useEffect(() => {
    if (el.current) applyProps(el.current, props);
  });
  useEffect(() => {
    const node = el.current;
    return node ? bindEvents(node, () => handlersOf(latest.current)) : undefined;
  }, []);
  return createElement("flexdock-manager", { ref: el, class: props.className, style: props.style, id: props.id }, props.children);
});
