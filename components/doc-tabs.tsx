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

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId, docs.length]);

  // A single doc needs no tabs; keep the page as quiet as before.
  if (docs.length < 2) return null;

  return (
    <div
      role="tablist"
      aria-label="Documents"
      className={cn(
        "no-scrollbar flex min-w-0 items-center gap-0.5 overflow-x-auto transition-opacity duration-200",
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
              "group/tab flex max-w-48 shrink-0 items-center rounded-lg text-sm transition-colors",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
            onAuxClick={(event) => {
              if (event.button === 1) closeDoc(doc.id);
            }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={active}
              title={label}
              onClick={() => switchDoc(doc.id)}
              className={cn(
                "truncate py-1 pr-1 pl-2.5 outline-none",
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
                "mr-1 flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background/60 hover:text-foreground focus-visible:opacity-100",
                active ? "opacity-60" : "opacity-0 group-hover/tab:opacity-60"
              )}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={12} strokeWidth={2} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
