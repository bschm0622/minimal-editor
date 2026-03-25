"use client";

import { useEffect, useCallback, useRef, useState, type MouseEvent } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model";
import type { Selection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
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
  const [linkMenuOpen, setLinkMenuOpen] = useState(false);
  const [linkSelection, setLinkSelection] = useState<Pick<Selection, "from" | "to"> | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        enableClickSelection: true,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: "editor-link",
          target: null,
          rel: null,
        },
      }),
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
        class:
          "tiptap-editor prose prose-neutral dark:prose-invert max-w-none outline-none min-h-[calc(100vh-8rem)] px-5 pt-8 sm:px-6",
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
      handleClick(view, _, event) {
        const target = event.target;

        if (!(target instanceof HTMLElement)) {
          return false;
        }

        const anchor = target.closest("a[href]");

        if (!anchor) {
          return false;
        }

        event.preventDefault();
        view.focus();
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      useEditorStore.getState().setContent(html);
      debouncedSave(html);
    },
  });

  const openLinkMenu = useCallback(() => {
    if (editor) {
      const { from, to } = editor.state.selection;
      setLinkSelection({ from, to });
    }

    setLinkMenuOpen(true);
  }, [editor]);

  useEditorKeyboardShortcuts(editor, {
    onOpenLinkEditor: openLinkMenu,
  });

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

  const handleContainerClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;

    if (editor && !editor.isFocused) {
      editor.commands.focus("end");
    }
  }, [editor]);

  const handleLinkMenuOpenChange = useCallback((open: boolean) => {
    setLinkMenuOpen(open);

    if (!open) {
      setLinkSelection(null);
    }
  }, []);

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
      <EditorBubbleMenu
        editor={editor}
        linkOpen={linkMenuOpen}
        onLinkOpenChange={handleLinkMenuOpenChange}
        savedSelection={linkSelection}
      />
      <EditorContent editor={editor} />
    </div>
  );
}
