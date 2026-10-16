import { createElement, forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties, type ReactNode } from "react";
import "./index.js";
import type { DockoramaManager } from "./engine/manager.js";
import { applyProps, bindEvents, type DockoramaHandlers, type DockoramaProps } from "./wrappers/bridge.js";

export type { DockoramaHandlers, DockoramaProps } from "./wrappers/bridge.js";

/** Props of `<DockoramaLayout>`: element properties plus `on*` callbacks. */
export interface DockoramaLayoutProps extends DockoramaProps {
  className?: string;
  style?: CSSProperties;
  id?: string;
  /** Children with `data-view="<id>"` become the views' content. */
  children?: ReactNode;
  onLayoutChange?: DockoramaHandlers["change"];
  onViewFocus?: DockoramaHandlers["focus"];
  onViewShow?: DockoramaHandlers["viewshow"];
  onBeforeClose?: DockoramaHandlers["beforeclose"];
  onBeforeMove?: DockoramaHandlers["beforemove"];
  onDragCancel?: DockoramaHandlers["dragcancel"];
  onTransfer?: DockoramaHandlers["transfer"];
  onDirtyChange?: DockoramaHandlers["dirty"];
  onLayoutIssue?: DockoramaHandlers["layoutissue"];
}

function handlersOf(p: DockoramaLayoutProps): DockoramaHandlers {
  return {
    change: p.onLayoutChange, focus: p.onViewFocus, viewshow: p.onViewShow,
    beforeclose: p.onBeforeClose, beforemove: p.onBeforeMove, dragcancel: p.onDragCancel, transfer: p.onTransfer, dirty: p.onDirtyChange, layoutissue: p.onLayoutIssue
  };
}

/**
 * React wrapper around `<dockorama-manager>`. The ref gives you the element, with methods like `undo()`,
 * `addView(id, content, options)`, `removeView(id)`, `getViewElement(id)` and `hasView(id)`.
 */
export const DockoramaLayout = forwardRef<DockoramaManager | null, DockoramaLayoutProps>(function DockoramaLayout(props, ref) {
  const el = useRef<DockoramaManager | null>(null);
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
  return createElement("dockorama-manager", { ref: el, class: props.className, style: props.style, id: props.id }, props.children);
});
