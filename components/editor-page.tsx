"use client";

import { useLayoutEffect } from "react";
import { useAlternativesUI } from "@/lib/alternatives-ui";
import { useDocListUI } from "@/lib/doc-list-ui";
import { useEditorStore } from "@/lib/editor-store";
import { AlternativesPanel } from "@/components/alternatives-panel";
import { Announcer } from "@/components/announcer";
import { DocList } from "@/components/doc-list";
import { Editor } from "@/components/editor";
import { Toolbar } from "@/components/toolbar";
import { TooltipProvider } from "@/components/ui/tooltip";

export function EditorPage() {
  const editor = useEditorStore((state) => state.editor);
  const hydrated = useEditorStore((state) => state.hydrated);
  const hydrate = useEditorStore((state) => state.hydrate);
  const panelOpen = useAlternativesUI((state) => state.panelOpen);
  const docListOpen = useDocListUI((state) => state.open);
  const severalDocs = useEditorStore((state) => state.docs.length > 1);

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
        <main
          className="flex flex-1 flex-col pt-12"
          data-alt-panel={panelOpen ? "open" : undefined}
          data-doc-list={docListOpen && severalDocs ? "open" : undefined}
        >
          <Editor />
        </main>
        <DocList />
        <AlternativesPanel />
        <Announcer />
      </div>
    </TooltipProvider>
  );
}
