"use client";

import { useEffect } from "react";
import type { Editor } from "@tiptap/core";
import {
  copyEditorContentAsMarkdown,
  openMarkdownFileIntoStore,
  saveCurrentDraftToNewFile,
  saveEditorContentToFile,
} from "./editor-file-actions";

type EditorKeyboardShortcutOptions = {
  onOpenLinkEditor?: () => void;
  enableFileCommands?: boolean;
};

export function useEditorKeyboardShortcuts(
  editor: Editor | null,
  options: EditorKeyboardShortcutOptions = {}
) {
  const { onOpenLinkEditor, enableFileCommands = true } = options;

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (!editor) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenLinkEditor?.();
        return;
      }

      if (!enableFileCommands) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        await openMarkdownFileIntoStore();
        return;
      }

      if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        await saveCurrentDraftToNewFile();
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
  }, [editor, enableFileCommands, onOpenLinkEditor]);
}
