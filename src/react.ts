import { createElement, forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties, type ReactNode } from "react";
import "./index.js";
import type { PazuruManager } from "./manager.js";
import { applyProps, bindEvents, type PazuruHandlers, type PazuruProps } from "./bridge.js";

export type { PazuruHandlers, PazuruProps } from "./bridge.js";

/** Props of `<PazuruLayout>`: element properties plus `on*` callbacks. */
export interface PazuruLayoutProps extends PazuruProps {
  className?: string;
  style?: CSSProperties;
  id?: string;
  /** Children with `data-view="<id>"` become the views' content. */
  children?: ReactNode;
  onLayoutChange?: PazuruHandlers["change"];
  onViewFocus?: PazuruHandlers["focus"];
  onViewShow?: PazuruHandlers["viewshow"];
  onBeforeClose?: PazuruHandlers["beforeclose"];
  onBeforeMove?: PazuruHandlers["beforemove"];
  onDragCancel?: PazuruHandlers["dragcancel"];
  onTransfer?: PazuruHandlers["transfer"];
  onDirtyChange?: PazuruHandlers["dirty"];
  onLayoutIssue?: PazuruHandlers["layoutissue"];
}

function handlersOf(p: PazuruLayoutProps): PazuruHandlers {
  return {
    change: p.onLayoutChange, focus: p.onViewFocus, viewshow: p.onViewShow,
    beforeclose: p.onBeforeClose, beforemove: p.onBeforeMove, dragcancel: p.onDragCancel, transfer: p.onTransfer, dirty: p.onDirtyChange, layoutissue: p.onLayoutIssue
  };
}

/**
 * React wrapper around `<pazuru-manager>`. The ref gives you the element, with methods like `undo()`,
 * `addView(id, content, options)`, `removeView(id)`, `getViewElement(id)` and `hasView(id)`.
 */
export const PazuruLayout = forwardRef<PazuruManager | null, PazuruLayoutProps>(function PazuruLayout(props, ref) {
  const el = useRef<PazuruManager | null>(null);
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
  return createElement("pazuru-manager", { ref: el, class: props.className, style: props.style, id: props.id }, props.children);
});
