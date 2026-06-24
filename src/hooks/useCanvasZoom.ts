import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";

const MIN_SCALE = 0.3;
const MAX_SCALE = 2;
const clampScale = (v: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));

export interface CanvasZoom {
  scale: number;
  scaleRef: RefObject<number>;
  applyZoom: (next: number, clientX?: number, clientY?: number) => void;
  fitToView: () => void;
}

/**
 * Zoom state + controls for a scrollable, scaled canvas. `scale` drives the CSS
 * transform on the content; the scroll position is corrected after each change
 * so the point under the cursor (or the viewport centre) stays put. Ctrl/Cmd +
 * wheel zooms toward the cursor (native listener so the page scroll is blocked).
 */
export function useCanvasZoom(
  scrollRef: RefObject<HTMLDivElement | null>,
  width: number,
  height: number,
): CanvasZoom {
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  const zoomAnchorRef = useRef<{
    cx: number;
    cy: number;
    contentX: number;
    contentY: number;
  } | null>(null);

  const applyZoom = useCallback(
    (next: number, clientX?: number, clientY?: number) => {
      const scroll = scrollRef.current;
      const cur = scaleRef.current;
      const target = clampScale(next);
      if (target === cur) return;
      if (scroll) {
        const rect = scroll.getBoundingClientRect();
        const cx = clientX != null ? clientX - rect.left : scroll.clientWidth / 2;
        const cy = clientY != null ? clientY - rect.top : scroll.clientHeight / 2;
        // Keep the content point under (cx, cy) stationary across the zoom.
        zoomAnchorRef.current = {
          cx,
          cy,
          contentX: (scroll.scrollLeft + cx) / cur,
          contentY: (scroll.scrollTop + cy) / cur,
        };
      }
      scaleRef.current = target;
      setScale(target);
    },
    [scrollRef],
  );

  // After the scaled layout commits, restore the anchored scroll position.
  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    const a = zoomAnchorRef.current;
    if (!scroll || !a) return;
    zoomAnchorRef.current = null;
    scroll.scrollLeft = a.contentX * scale - a.cx;
    scroll.scrollTop = a.contentY * scale - a.cy;
  }, [scale, scrollRef]);

  const fitToView = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll || width <= 0 || height <= 0) return;
    const pad = 48;
    const next = clampScale(
      Math.min((scroll.clientWidth - pad) / width, (scroll.clientHeight - pad) / height),
    );
    zoomAnchorRef.current = null;
    scaleRef.current = next;
    setScale(next);
    requestAnimationFrame(() => {
      scroll.scrollLeft = (width * next - scroll.clientWidth) / 2;
      scroll.scrollTop = (height * next - scroll.clientHeight) / 2;
    });
  }, [width, height, scrollRef]);

  // Ctrl/Cmd + wheel to zoom toward the cursor.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      applyZoom(scaleRef.current * factor, e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyZoom, scrollRef]);

  return { scale, scaleRef, applyZoom, fitToView };
}
