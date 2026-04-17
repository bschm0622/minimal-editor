"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/lib/editor-store";
import { CompareWorkspace } from "@/components/compare-workspace";
import { Editor } from "@/components/editor";
import { Toolbar } from "@/components/toolbar";
import { TooltipProvider } from "@/components/ui/tooltip";

export function EditorPage() {
  const compareMode = useEditorStore((state) => state.compareMode);
  const hydrated = useEditorStore((state) => state.hydrated);
  const hydrate = useEditorStore((state) => state.hydrate);

  useEffect(() => {
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
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
