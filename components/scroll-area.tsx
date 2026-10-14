"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

type Orientation = "vertical" | "horizontal" | "both";

type ScrollAreaProps = {
  orientation?: Orientation;
  className?: string;
  viewportClassName?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "children" | "className">;

type ThumbState = {
  size: number;
  offset: number;
  visible: boolean;
};

const HIDDEN =
  "friday-scroll-hide [-ms-overflow-style:none] [scrollbar-width:none]";

/**
 * Overflow container with a custom neon-green thumb.
 * Hides the native OS scrollbar (Windows ignores ::-webkit-scrollbar styling).
 */
export function ScrollArea({
  orientation = "vertical",
  className,
  viewportClassName,
  children,
  ...props
}: ScrollAreaProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ axis: "y" | "x"; start: number; scroll: number } | null>(
    null,
  );
  const [vThumb, setVThumb] = useState<ThumbState>({
    size: 0,
    offset: 0,
    visible: false,
  });
  const [hThumb, setHThumb] = useState<ThumbState>({
    size: 0,
    offset: 0,
    visible: false,
  });

  const sync = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;

    if (orientation === "vertical" || orientation === "both") {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const overflow = scrollHeight - clientHeight;
      if (overflow > 1) {
        const size = Math.max((clientHeight / scrollHeight) * clientHeight, 28);
        const maxOffset = clientHeight - size;
        setVThumb({
          visible: true,
          size,
          offset: maxOffset <= 0 ? 0 : (scrollTop / overflow) * maxOffset,
        });
      } else {
        setVThumb({ size: 0, offset: 0, visible: false });
      }
    }

    if (orientation === "horizontal" || orientation === "both") {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const overflow = scrollWidth - clientWidth;
      if (overflow > 1) {
        const size = Math.max((clientWidth / scrollWidth) * clientWidth, 28);
        const maxOffset = clientWidth - size;
        setHThumb({
          visible: true,
          size,
          offset: maxOffset <= 0 ? 0 : (scrollLeft / overflow) * maxOffset,
        });
      } else {
        setHThumb({ size: 0, offset: 0, visible: false });
      }
    }
  }, [orientation]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, [sync, children]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      const el = viewportRef.current;
      if (!drag || !el) return;
      if (drag.axis === "y") {
        const overflow = el.scrollHeight - el.clientHeight;
        const track = el.clientHeight - vThumb.size;
        if (track <= 0 || overflow <= 0) return;
        const delta = event.clientY - drag.start;
        el.scrollTop = drag.scroll + (delta / track) * overflow;
      } else {
        const overflow = el.scrollWidth - el.clientWidth;
        const track = el.clientWidth - hThumb.size;
        if (track <= 0 || overflow <= 0) return;
        const delta = event.clientX - drag.start;
        el.scrollLeft = drag.scroll + (delta / track) * overflow;
      }
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [vThumb.size, hThumb.size]);

  function startDrag(
    axis: "y" | "x",
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const el = viewportRef.current;
    if (!el) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      axis,
      start: axis === "y" ? event.clientY : event.clientX,
      scroll: axis === "y" ? el.scrollTop : el.scrollLeft,
    };
  }

  const overflowClass =
    orientation === "vertical"
      ? "overflow-y-auto overflow-x-hidden"
      : orientation === "horizontal"
        ? "overflow-x-auto overflow-y-hidden"
        : "overflow-auto";

  return (
    <div className={["relative min-h-0", className].filter(Boolean).join(" ")} {...props}>
      <div
        ref={viewportRef}
        className={[
          HIDDEN,
          // Inherit max-height from the wrapper so overflow actually kicks in.
          "max-h-[inherit] w-full",
          overflowClass,
          viewportClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </div>

      {vThumb.visible ? (
        <div
          className="pointer-events-none absolute inset-y-0.5 right-0.5 w-1.5"
          aria-hidden
        >
          <div
            className="pointer-events-auto absolute inset-x-0 cursor-grab bg-neon-green/35 transition-colors hover:bg-neon-green/70 active:cursor-grabbing"
            style={{
              height: vThumb.size,
              transform: `translateY(${vThumb.offset}px)`,
            }}
            onPointerDown={(e) => startDrag("y", e)}
          />
        </div>
      ) : null}

      {hThumb.visible ? (
        <div
          className="pointer-events-none absolute inset-x-0.5 bottom-0.5 h-1.5"
          aria-hidden
        >
          <div
            className="pointer-events-auto absolute inset-y-0 cursor-grab bg-neon-green/35 transition-colors hover:bg-neon-green/70 active:cursor-grabbing"
            style={{
              width: hThumb.size,
              transform: `translateX(${hThumb.offset}px)`,
            }}
            onPointerDown={(e) => startDrag("x", e)}
          />
        </div>
      ) : null}
    </div>
  );
}
