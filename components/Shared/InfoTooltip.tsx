"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import SvgInfo from "@/components/Shared/InfoIcon";
import SvgClose from "@/components/Shared/CloseIcon";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }

    // Safari fallback
    media.addListener(update);
    return () => media.removeListener(update);
  }, [query]);

  return matches;
}

export default function InfoTooltip({
  content,
  ariaLabel,
  className,
}: {
  content: string;
  ariaLabel?: string;
  className?: string;
}) {
  const tooltipId = useId();
  const canHover = useMediaQuery("(hover: hover) and (pointer: fine)");
  const isSheetScreen = useMediaQuery("(max-width: 767px)");

  const [tooltipOpen, setTooltipOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);

  const [sheetMounted, setSheetMounted] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const touchStartYRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  // Bottom sheet only on narrow screens (<768px)
  const shouldUseSheet = isSheetScreen;

  const updateAnchor = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewportWidth = window.innerWidth || 0;
    const margin = 12;
    const left = Math.min(Math.max(rect.left + rect.width / 2, margin), Math.max(margin, viewportWidth - margin));
    const top = rect.bottom + 8;
    setAnchor({ left, top });
  };

  const closeSheet = () => {
    setDragging(false);
    setDragY(0);
    setSheetVisible(false);

    window.setTimeout(() => {
      setSheetMounted(false);
    }, 220);
  };

  const openSheet = () => {
    setSheetMounted(true);
    requestAnimationFrame(() => setSheetVisible(true));
  };

  useEffect(() => {
    if (!sheetMounted) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSheet();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sheetMounted]);

  useEffect(() => {
    if (!sheetMounted) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [sheetMounted]);

  useEffect(() => {
    if (shouldUseSheet) {
      setTooltipOpen(false);
    } else {
      closeSheet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldUseSheet]);

  useEffect(() => {
    if (shouldUseSheet) return;
    if (!tooltipOpen) return;
    updateAnchor();

    const onScroll = () => updateAnchor();
    const onResize = () => updateAnchor();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tooltipOpen, shouldUseSheet]);

  const onTriggerClick = () => {
    if (shouldUseSheet) {
      openSheet();
      return;
    }
    setTooltipOpen((v) => !v);
  };

  const openTooltip = () => {
    if (shouldUseSheet) return;
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    if (typeof window !== "undefined") updateAnchor();
    setTooltipOpen(true);
  };

  const closeTooltipSoon = () => {
    if (shouldUseSheet) return;
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setTooltipOpen(false), 80);
  };

  return (
    <span className={"relative inline-flex items-center " + (className ?? "")}>
      <button
        type="button"
        ref={triggerRef}
        aria-label={ariaLabel ?? "More info"}
        aria-describedby={!shouldUseSheet && tooltipOpen ? tooltipId : undefined}
        onClick={onTriggerClick}
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltipSoon}
        onFocus={openTooltip}
        onBlur={closeTooltipSoon}
        className="inline-flex h-5 w-5 items-center justify-center rounded-md text-slate-400 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-white/20"
      >
        <SvgInfo className="h-4 w-4" />
      </button>

      {!shouldUseSheet && tooltipOpen && anchor && typeof document !== "undefined"
        ? createPortal(
            <div
              id={tooltipId}
              role="tooltip"
              onMouseEnter={openTooltip}
              onMouseLeave={closeTooltipSoon}
              className="fixed z-[1000] w-72 -translate-x-1/2 rounded-xl bg-black/90 px-3 py-2 text-xs leading-relaxed text-white shadow-2xl ring-1 ring-white/10"
              style={{ left: anchor.left, top: anchor.top }}
            >
              {content}
            </div>,
            document.body
          )
        : null}

      {sheetMounted && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[1000]">
              <button
                type="button"
                aria-label="Close"
                onClick={closeSheet}
                className={
                  "absolute inset-0 bg-black/60 transition-opacity duration-200 " +
                  (sheetVisible ? "opacity-100" : "opacity-0")
                }
              />

              <div
                role="dialog"
                aria-modal="true"
                aria-label={ariaLabel ?? "Info"}
                className="absolute inset-x-0 bottom-0"
                style={{
                  transform: sheetVisible ? `translateY(${dragY}px)` : "translateY(110%)",
                  transition: dragging ? "none" : "transform 220ms ease",
                }}
              >
                <div
                  className="mx-auto w-full rounded-t-3xl border border-white/10 bg-slate-950/95 text-white shadow-2xl backdrop-blur"
                  style={{ height: "clamp(240px, 35vh, 440px)" }}
                >
                  <div
                    className="flex h-full flex-col p-4"
                    style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
                  >
                    <div
                      className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20"
                      onTouchStart={(e) => {
                        touchStartYRef.current = e.touches[0]?.clientY ?? null;
                        setDragging(true);
                      }}
                      onTouchMove={(e) => {
                        const startY = touchStartYRef.current;
                        if (startY == null) return;
                        const currentY = e.touches[0]?.clientY ?? startY;
                        const delta = Math.max(0, currentY - startY);
                        setDragY(delta);
                      }}
                      onTouchEnd={() => {
                        const shouldClose = dragY > 80;
                        touchStartYRef.current = null;
                        setDragging(false);

                        if (shouldClose) {
                          closeSheet();
                        } else {
                          setDragY(0);
                        }
                      }}
                    />

                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-semibold">What this means</div>
                      <button
                        type="button"
                        onClick={closeSheet}
                        aria-label="Close"
                        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-black/60 bg-slate-950/95 text-slate-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
                      >
                        <SvgClose className="h-4 w-4" fill="currentColor" />
                      </button>
                    </div>
                    <div className="mt-2 flex-1 overflow-y-auto text-sm leading-relaxed text-slate-200">
                      {content}
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
