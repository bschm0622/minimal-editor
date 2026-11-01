"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { useDocListUI } from "@/lib/doc-list-ui";
import { docLabel, useEditorStore } from "@/lib/editor-store";
import { cn } from "@/lib/utils";

/*
 * The docs, listed down the left margin under the quill, styled like the tabs
 * they replace. The quill (or ⌥L) shows and hides it; it stays put while you
 * switch docs. Drag a doc (or ⌥↑/↓ on it) to reorder.
 */
export function DocList() {
  const { docs, activeId, switchDoc, closeDoc, moveDoc } = useEditorStore(
    useShallow((state) => ({
      docs: state.docs,
      activeId: state.activeId,
      switchDoc: state.switchDoc,
      closeDoc: state.closeDoc,
      moveDoc: state.moveDoc,
    }))
  );
  const { open, close } = useDocListUI();
  const several = docs.length > 1;
  const activeRowRef = useRef<HTMLLIElement>(null);
  const [dragging, setDragging] = useState<{ id: string; dy: number } | null>(null);
  const justDragged = useRef(false);

  useEffect(() => {
    if (open) activeRowRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeId, open]);

  // A single doc needs no list.
  useEffect(() => {
    if (!several) close();
  }, [several, close]);

  const pick = (id: string) => {
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    switchDoc(id);
  };

  // Dragging reorders live: the doc swaps places as the pointer crosses half a row.
  const startDrag = (event: PointerEvent<HTMLLIElement>, id: string) => {
    if (event.button !== 0 || (event.target as Element).closest("[data-close]")) return;
    const rowHeight = event.currentTarget.offsetHeight;
    let startY = event.clientY;
    let moved = false;
    const onMove = (move: globalThis.PointerEvent) => {
      let dy = move.clientY - startY;
      if (!moved && Math.abs(dy) < 4) return;
      moved = true;
      const list = useEditorStore.getState().docs;
      const from = list.findIndex((d) => d.id === id);
      const to = Math.max(0, Math.min(list.length - 1, from + Math.round(dy / rowHeight)));
      if (to !== from) {
        moveDoc(from, to);
        startY += (to - from) * rowHeight;
        dy = move.clientY - startY;
      }
      setDragging({ id, dy });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      justDragged.current = moved;
      setDragging(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const moveWithKeys = (event: KeyboardEvent, index: number) => {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    event.preventDefault();
    moveDoc(index, index + (event.key === "ArrowUp" ? -1 : 1));
  };

  if (!open || !several) return null;

  return (
    <nav
      aria-label="Documents"
      className="fixed top-14 bottom-4 left-1 z-40 w-56 overflow-y-auto bg-background p-1 max-sm:right-1 max-sm:bottom-auto max-sm:w-auto max-sm:rounded-2xl max-sm:border max-sm:border-border max-sm:shadow-lg"
    >
      <ul className="flex flex-col gap-0.5 select-none">
        {docs.map((doc, index) => {
          const active = doc.id === activeId;
          const label = docLabel(doc);
          const isDragging = dragging?.id === doc.id;

          return (
            <li
              key={doc.id}
              ref={active ? activeRowRef : undefined}
              onPointerDown={(event) => startDrag(event, doc.id)}
              onAuxClick={(event) => {
                if (event.button === 1) closeDoc(doc.id);
              }}
              style={isDragging ? { transform: `translateY(${dragging.dy}px)` } : undefined}
              className={cn(
                "group/tab relative flex items-center rounded-full text-sm transition-colors has-[>button:first-child:focus-visible]:ring-[3px] has-[>button:first-child:focus-visible]:ring-ring/50",
                // Only the open doc gets a fill, so a hovered one never looks open too.
                active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                isDragging && "z-10 cursor-grabbing text-foreground shadow-sm"
              )}
            >
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                title={label}
                onClick={() => pick(doc.id)}
                onKeyDown={(event) => moveWithKeys(event, index)}
                className={cn(
                  "min-w-0 flex-1 truncate py-1 pr-1 pl-3 text-left outline-none",
                  !doc.title && "italic"
                )}
              >
                {label}
              </button>
              <button
                type="button"
                data-close
                aria-label={`Close ${label}`}
                onClick={() => closeDoc(doc.id)}
                className={cn(
                  "mr-1 flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-foreground/10 hover:text-foreground hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  active ? "opacity-60" : "opacity-0 group-hover/tab:opacity-60"
                )}
              >
                <HugeiconsIcon icon={Cancel01Icon} size={12} strokeWidth={2} />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
