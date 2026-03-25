"use client";

import { useEditorStore, debouncedSave } from "@/lib/editor-store";
import { EditorSurface } from "./editor-surface";

export function Editor() {
  const { content, focusMode, font, hydrated, setEditor } = useEditorStore();

  if (!hydrated) return null;

  return (
    <EditorSurface
      content={content}
      onContentChange={(html) => {
        useEditorStore.getState().setContent(html);
        debouncedSave(html);
      }}
      onEditorReady={setEditor}
      focusMode={focusMode}
      font={font}
      autofocus="end"
      enableFileShortcuts
      containerClassName="mx-auto max-w-3xl"
    />
  );
}
