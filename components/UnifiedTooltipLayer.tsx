"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type TooltipState = {
  text: string;
  x: number;
  y: number;
  placement: "top" | "bottom";
};

function tooltipTarget(node: EventTarget | null): Element | null {
  return node instanceof Element ? node.closest("[data-tooltip], [title]") : null;
}

function tooltipText(target: Element): string {
  const existing = target.getAttribute("data-tooltip")?.trim();
  if (existing) return existing;

  const nativeTitle = target.getAttribute("title")?.trim();
  if (!nativeTitle) return "";

  // Remove the browser tooltip as soon as the element is reached. The shared
  // layer below now owns the same text for mouse and keyboard interaction.
  target.setAttribute("data-tooltip", nativeTitle);
  target.removeAttribute("title");
  return nativeTitle;
}

function tooltipPosition(target: Element): Omit<TooltipState, "text"> {
  const rect = target.getBoundingClientRect();
  const placement = rect.bottom + 64 <= window.innerHeight ? "bottom" : "top";
  return {
    x: Math.min(window.innerWidth - 12, Math.max(12, rect.left + rect.width / 2)),
    y: placement === "bottom" ? rect.bottom + 8 : rect.top - 8,
    placement
  };
}

export function UnifiedTooltipLayer() {
  const activeTarget = useRef<Element | null>(null);
  const tooltipElement = useRef<HTMLSpanElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useLayoutEffect(() => {
    const element = tooltipElement.current;
    if (!element || !tooltip) return;
    const rect = element.getBoundingClientRect();
    const leftCorrection = Math.max(0, 8 - rect.left);
    const rightCorrection = Math.max(0, rect.right - (window.innerWidth - 8));
    if (leftCorrection || rightCorrection) {
      setTooltip((current) => current ? { ...current, x: current.x + leftCorrection - rightCorrection } : null);
    }
  }, [tooltip]);

  useEffect(() => {
    document.documentElement.dataset.unifiedTooltips = "true";

    const show = (target: Element | null) => {
      if (!target) return;
      const text = tooltipText(target);
      if (!text) return;
      activeTarget.current = target;
      setTooltip({ text, ...tooltipPosition(target) });
    };

    const hide = (target: Element | null, relatedTarget: EventTarget | null) => {
      if (!target || activeTarget.current !== target) return;
      if (relatedTarget instanceof Node && target.contains(relatedTarget)) return;
      activeTarget.current = null;
      setTooltip(null);
    };

    const isCoarseMapControl = (target: Element | null) => Boolean(
      target
      && window.matchMedia("(hover: none), (pointer: coarse)").matches
      && target.closest(".punktlandung-guess-map-panel, .maplibregl-control-container, [aria-label='Interaktive 3D-Ergebniskarte']")
    );
    const onPointerDown = (event: PointerEvent) => {
      const target = tooltipTarget(event.target);
      if (event.pointerType === "mouse" || !isCoarseMapControl(target)) return;
      activeTarget.current = null;
      setTooltip(null);
    };
    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      show(tooltipTarget(event.target));
    };
    const onPointerOut = (event: PointerEvent) => hide(tooltipTarget(event.target), event.relatedTarget);
    const onFocusIn = (event: FocusEvent) => {
      const target = tooltipTarget(event.target);
      if (isCoarseMapControl(target)) {
        activeTarget.current = null;
        setTooltip(null);
        return;
      }
      show(target);
    };
    const onFocusOut = (event: FocusEvent) => hide(tooltipTarget(event.target), event.relatedTarget);
    const reposition = () => {
      const target = activeTarget.current;
      if (!target || !target.isConnected) {
        activeTarget.current = null;
        setTooltip(null);
        return;
      }
      setTooltip((current) => current ? { ...current, ...tooltipPosition(target) } : null);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("pointerout", onPointerOut, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);

    return () => {
      delete document.documentElement.dataset.unifiedTooltips;
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("pointerout", onPointerOut, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, []);

  if (!tooltip) return null;

  return (
    <span
      ref={tooltipElement}
      className="punktlandung-unified-tooltip"
      role="tooltip"
      data-placement={tooltip.placement}
      style={{ left: tooltip.x, top: tooltip.y }}
    >
      {tooltip.text}
    </span>
  );
}
