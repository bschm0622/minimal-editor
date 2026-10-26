"use client";

import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { docLabel, useEditorStore } from "@/lib/editor-store";
import { cn } from "@/lib/utils";

export function DocTabs({ dimmed }: { dimmed: boolean }) {
  const { docs, activeId, switchDoc, closeDoc } = useEditorStore(
    useShallow((state) => ({
      docs: state.docs,
      activeId: state.activeId,
      switchDoc: state.switchDoc,
      closeDoc: state.closeDoc,
    }))
  );
  const activeTabRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const hasTabs = docs.length > 1;

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId, docs.length]);

  // Fade whichever edge has more tabs past it, so a cut-off title reads as
  // "scroll for more" rather than a clipped label.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const update = () => {
      const start = nav.scrollLeft > 1 ? "transparent" : "black";
      const end =
        nav.scrollLeft < nav.scrollWidth - nav.clientWidth - 1 ? "transparent" : "black";
      nav.style.maskImage = `linear-gradient(to right, ${start}, black 2rem, black calc(100% - 2rem), ${end})`;
    };
    update();
    nav.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    return () => {
      nav.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [hasTabs, docs]);

  // A single doc needs no tabs.
  if (!hasTabs) return null;

  return (
    <nav
      ref={navRef}
      aria-label="Documents"
      className={cn(
        // Padding keeps focus rings inside the scroll box; scroll padding keeps
        // the active tab clear of the faded edges.
        "no-scrollbar -mx-1 flex min-w-0 scroll-px-8 items-center gap-0.5 overflow-x-auto p-1 transition-opacity duration-200",
        dimmed && "opacity-40"
      )}
    >
      {docs.map((doc) => {
        const active = doc.id === activeId;
        const label = docLabel(doc);

        return (
          <div
            key={doc.id}
            ref={active ? activeTabRef : undefined}
            className={cn(
              "group/tab flex max-w-48 shrink-0 items-center rounded-full text-sm transition-colors has-[>button:first-child:focus-visible]:ring-[3px] has-[>button:first-child:focus-visible]:ring-ring/50",
              // Only the open doc gets a fill, so a hovered tab never looks open too.
              active
                ? cn("text-foreground", !dimmed && "bg-muted")
                : "text-muted-foreground hover:text-foreground"
            )}
            onAuxClick={(event) => {
              if (event.button === 1) closeDoc(doc.id);
            }}
          >
            <button
              type="button"
              aria-current={active ? "page" : undefined}
              title={label}
              onClick={() => switchDoc(doc.id)}
              className={cn(
                "truncate py-1 pr-1 pl-3 outline-none",
                !doc.title && "italic"
              )}
            >
              {label}
            </button>
            <button
              type="button"
              aria-label={`Close ${label}`}
              onClick={() => closeDoc(doc.id)}
              className={cn(
                "mr-1 flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-foreground/10 hover:text-foreground hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50",
                active && !dimmed ? "opacity-60" : "opacity-0 group-hover/tab:opacity-60"
              )}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={12} strokeWidth={2} />
            </button>
          </div>
        );
      })}
    </nav>
  );
}
