"use client";

import { useEffect, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions/placeholder";
import { Focus } from "@tiptap/extensions/focus";
import { useEditorStore, debouncedSave } from "@/lib/editor-store";
import {
  looksLikeMarkdown,
  markdownToHtml,
  normalizeMarkdownPaste,
} from "@/lib/markdown";
import { useEditorKeyboardShortcuts } from "@/lib/use-editor-keyboard-shortcuts";
import { EditorBubbleMenu } from "./editor-bubble-menu";
import { SlashCommands } from "./slash-command";
import { cn } from "@/lib/utils";

export function Editor() {
  const { content, focusMode, font, hydrate, hydrated, setEditor } =
    useEditorStore();
  const initialContentAppliedRef = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: ({ editor }) =>
          editor.isEmpty
            ? "Start writing... Type / for blocks, or # for a heading."
            : "",
      }),
      Focus.configure({
        className: "has-focus",
        mode: "deepest",
      }),
      SlashCommands,
    ],
    content: "",
    autofocus: "end",
    editorProps: {
      attributes: {
        class: "prose prose-neutral dark:prose-invert max-w-none outline-none min-h-[calc(100vh-8rem)] px-4 py-8 sm:px-0",
      },
      handlePaste(view, event) {
        const plainText = event.clipboardData?.getData("text/plain") ?? "";

        if (!plainText || !looksLikeMarkdown(plainText)) {
          return false;
        }

        const wrapper = document.createElement("div");
        wrapper.innerHTML = markdownToHtml(normalizeMarkdownPaste(plainText));

        const slice = ProseMirrorDOMParser.fromSchema(view.state.schema).parseSlice(
          wrapper
        );

        view.dispatch(view.state.tr.replaceSelection(slice));
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      useEditorStore.getState().setContent(html);
      debouncedSave(html);
    },
  });

  useEditorKeyboardShortcuts(editor);

  useEffect(() => {
    setEditor(editor);
    return () => setEditor(null);
  }, [editor, setEditor]);

  // Hydrate from localStorage on mount
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Apply persisted content once after hydration. Re-applying content while the
  // document is structurally empty can reset the selection after input rules.
  useEffect(() => {
    if (!editor || !hydrated || initialContentAppliedRef.current) return;

    if (content) {
      editor.commands.setContent(content, { emitUpdate: false });
    }

    initialContentAppliedRef.current = true;
  }, [editor, content, hydrated]);

  useEffect(() => {
    if (!editor || !hydrated || !initialContentAppliedRef.current) return;
    if (content === editor.getHTML()) return;

    editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, content, hydrated]);

  const handleContainerClick = useCallback(() => {
    if (editor && !editor.isFocused) {
      editor.commands.focus("end");
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-2xl flex-1 cursor-text",
        focusMode && "focus-mode",
        font === "serif" && "font-serif",
        font === "mono" && "font-mono",
        font === "sans" && "font-sans"
      )}
      onClick={handleContainerClick}
    >
      <EditorBubbleMenu editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
