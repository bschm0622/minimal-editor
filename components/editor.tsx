"use client";

import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  flushPendingSave,
  scheduleSave,
  useEditorStore,
} from "@/lib/editor-store";
import { EditorSurface } from "./editor-surface";

export function Editor() {
  const { activeId, externalRevision, focusMode, font, setEditor } =
    useEditorStore(
      useShallow((state) => ({
        activeId: state.activeId,
        externalRevision: state.externalRevision,
        focusMode: state.focusMode,
        font: state.font,
        setEditor: state.setEditor,
      }))
    );

  // Don't lose the last few keystrokes when the tab is closed or hidden.
  useEffect(() => {
    const flush = () => flushPendingSave();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <EditorSurface
      docId={activeId}
      docRevision={externalRevision}
      onChange={scheduleSave}
      onEditorReady={setEditor}
      focusMode={focusMode}
      font={font}
      containerClassName="mx-auto max-w-3xl"
    />
  );
}
