"use client";

import { useEffect, useId, useRef, useState } from "react";
import SvgInfo from "@/components/Shared/InfoIcon";
import InfoTooltipPopover from "@/components/Shared/InfoTooltipPopover";
import InfoTooltipSheet from "@/components/Shared/InfoTooltipSheet";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

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
  const isSheetScreen = useMediaQuery("(max-width: 767px)");

  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
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

  useEffect(() => {
    if (shouldUseSheet) {
      setTooltipOpen(false);
    } else {
      setSheetOpen(false);
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
      setSheetOpen(true);
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

      <InfoTooltipPopover
        open={!shouldUseSheet && tooltipOpen}
        tooltipId={tooltipId}
        anchor={anchor}
        content={content}
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltipSoon}
      />

      <InfoTooltipSheet
        open={shouldUseSheet && sheetOpen}
        onOpenChange={setSheetOpen}
        content={content}
        ariaLabel={ariaLabel}
      />
    </span>
  );
}
