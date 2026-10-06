"use client";

import { useEffect } from "react";
import type { Editor } from "@tiptap/core";
import { copyEditorContentAsMarkdown } from "./editor-copy-actions";
import { useEditorStore } from "./editor-store";

type EditorKeyboardShortcutOptions = {
  onOpenLinkEditor?: () => void;
};

export const COPY_MARKDOWN_EVENT = "copy-markdown";

export async function copyDocAsMarkdown(editor: Editor) {
  await copyEditorContentAsMarkdown(editor);
  window.dispatchEvent(new Event(COPY_MARKDOWN_EVENT));
}

export function useEditorKeyboardShortcuts(
  editor: Editor | null,
  options: EditorKeyboardShortcutOptions = {}
) {
  const { onOpenLinkEditor } = options;

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (!editor) return;

      const mod = event.metaKey || event.ctrlKey;

      // Doc shortcuts use Alt + physical key so they work on macOS, where
      // Option changes the typed character, and don't fight browser tab keys.
      if (event.altKey && !mod) {
        const store = useEditorStore.getState();

        if (event.code === "KeyN") {
          event.preventDefault();
          store.newDoc();
          return;
        }

        if (event.code === "KeyW") {
          event.preventDefault();
          store.closeDoc(store.activeId);
          return;
        }

        if (event.code === "BracketLeft" || event.code === "BracketRight") {
          event.preventDefault();
          store.switchDocBy(event.code === "BracketLeft" ? -1 : 1);
          return;
        }

        const digit = /^Digit([1-9])$/.exec(event.code);
        if (digit) {
          event.preventDefault();
          const docs = store.docs;
          const n = Number(digit[1]);
          const target = n === 9 ? docs[docs.length - 1] : docs[n - 1];
          if (target) store.switchDoc(target.id);
          return;
        }
      }

      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenLinkEditor?.();
        return;
      }

      if (mod && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        await copyDocAsMarkdown(editor);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editor, onOpenLinkEditor]);
}
