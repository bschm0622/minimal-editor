"use client";

import { useLayoutEffect } from "react";
import { useEditorStore } from "@/lib/editor-store";
import { CompareWorkspace } from "@/components/compare-workspace";
import { Editor } from "@/components/editor";
import { Toolbar } from "@/components/toolbar";
import { TooltipProvider } from "@/components/ui/tooltip";

export function EditorPage() {
  const compareMode = useEditorStore((state) => state.compareMode);
  const editor = useEditorStore((state) => state.editor);
  const hydrated = useEditorStore((state) => state.hydrated);
  const hydrate = useEditorStore((state) => state.hydrate);

  useLayoutEffect(() => {
    const previousScrollRestoration = history.scrollRestoration;
    let frameId: number | null = null;

    const resetScrollPosition = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    };

    const focusEditorWithoutScrolling = () => {
      if (!editor) return;

      frameId = requestAnimationFrame(() => {
        editor.commands.focus("start", { scrollIntoView: false });
      });
    };

    history.scrollRestoration = "manual";
    resetScrollPosition();
    focusEditorWithoutScrolling();

    const handlePageShow = () => {
      resetScrollPosition();
      focusEditorWithoutScrolling();
    };

    window.addEventListener("pageshow", handlePageShow);

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      window.removeEventListener("pageshow", handlePageShow);
      history.scrollRestoration = previousScrollRestoration;
    };
  }, [editor]);

  useLayoutEffect(() => {
    if (!hydrated) {
      hydrate();
    }
  }, [hydrate, hydrated]);

  if (!hydrated) return null;

  return (
    <TooltipProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <Toolbar />
        <main className="flex flex-1 flex-col pt-12">
          {compareMode ? <CompareWorkspace /> : <Editor />}
        </main>
      </div>
    </TooltipProvider>
  );
}
