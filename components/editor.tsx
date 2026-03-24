"use client";

import { useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions/placeholder";
import { Focus } from "@tiptap/extensions/focus";
import { useEditorStore, debouncedSave } from "@/lib/editor-store";
import { debouncedFileSync } from "@/lib/file-sync";
import { htmlToMarkdown } from "@/lib/markdown";
import { EditorBubbleMenu } from "./editor-bubble-menu";
import { SlashCommands } from "./slash-command";
import { cn } from "@/lib/utils";

export function Editor() {
  const { content, focusMode, font, hydrate } = useEditorStore();

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Start writing...",
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
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      useEditorStore.getState().setContent(html);
      debouncedSave(html);
      debouncedFileSync(htmlToMarkdown(html));
    },
  });

  // Hydrate from localStorage on mount
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Set editor content once hydrated
  useEffect(() => {
    if (editor && content && editor.isEmpty) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  // Cmd+Shift+C to copy as Markdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "c") {
        e.preventDefault();
        if (!editor) return;
        const markdown = htmlToMarkdown(editor.getHTML());
        navigator.clipboard.writeText(markdown);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editor]);

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
