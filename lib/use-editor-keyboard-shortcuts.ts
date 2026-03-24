"use client";

import { useEffect } from "react";
import type { Editor } from "@tiptap/core";
import {
  copyEditorContentAsMarkdown,
  openMarkdownFileIntoStore,
  saveEditorContentToFile,
} from "./editor-file-actions";

export function useEditorKeyboardShortcuts(editor: Editor | null) {
  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (!editor) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        await openMarkdownFileIntoStore();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        await saveEditorContentToFile(editor);
        return;
      }

      if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "c"
      ) {
        event.preventDefault();
        await copyEditorContentAsMarkdown(editor);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editor]);
}
