"use client";

import { Editor } from "@/components/editor";
import { Toolbar } from "@/components/toolbar";
import { TooltipProvider } from "@/components/ui/tooltip";

export function EditorPage() {
  return (
    <TooltipProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <Toolbar />
        <main className="flex flex-1 flex-col pt-12">
          <Editor />
        </main>
      </div>
    </TooltipProvider>
  );
}
