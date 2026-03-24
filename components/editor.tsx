"use client";

import { useEffect, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions/placeholder";
import { Focus } from "@tiptap/extensions/focus";
import { useEditorStore, debouncedSave } from "@/lib/editor-store";
import { debouncedFileSync, openFile, saveFile, saveFileAs } from "@/lib/file-sync";
import { htmlToMarkdown } from "@/lib/markdown";
import { EditorBubbleMenu } from "./editor-bubble-menu";
import { SlashCommands } from "./slash-command";
import { cn } from "@/lib/utils";

export function Editor() {
  const { content, focusMode, font, hydrate, hydrated, loadContent } =
    useEditorStore();
  const initialContentAppliedRef = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Start writing... Type / for blocks, or # for a heading.",
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

  // Keyboard shortcuts for file actions and Markdown copy.
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!editor) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        const nextContent = await openFile();
        if (nextContent === null) return;
        loadContent(nextContent);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const markdown = htmlToMarkdown(editor.getHTML());
        const fileHandle = useEditorStore.getState().fileHandle;

        if (fileHandle) {
          await saveFile(markdown);
        } else {
          await saveFileAs(markdown);
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "c") {
        e.preventDefault();
        const markdown = htmlToMarkdown(editor.getHTML());
        await navigator.clipboard.writeText(markdown);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editor, loadContent]);

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
