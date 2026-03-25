"use client";

import {
  useEffect,
  useCallback,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model";
import type { Selection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions/placeholder";
import { Focus } from "@tiptap/extensions/focus";
import type { EditorFont } from "@/lib/editor-store";
import {
  looksLikeMarkdown,
  markdownToHtml,
  normalizeMarkdownPaste,
} from "@/lib/markdown";
import { useEditorKeyboardShortcuts } from "@/lib/use-editor-keyboard-shortcuts";
import { cn } from "@/lib/utils";
import { EditorBubbleMenu } from "./editor-bubble-menu";
import { SlashCommands } from "./slash-command";

type EditorSurfaceProps = {
  content: string;
  onContentChange: (content: string) => void;
  onEditorReady?: (editor: Editor | null) => void;
  placeholder?: string;
  autofocus?: "end" | false;
  enableFileShortcuts?: boolean;
  focusMode?: boolean;
  font?: EditorFont;
  containerClassName?: string;
  contentClassName?: string;
};

export function EditorSurface({
  content,
  onContentChange,
  onEditorReady,
  placeholder = "Start writing... Type / for blocks, or # for a heading.",
  autofocus = false,
  enableFileShortcuts = false,
  focusMode = false,
  font = "sans",
  containerClassName,
  contentClassName,
}: EditorSurfaceProps) {
  const initialContentAppliedRef = useRef(false);
  const [linkMenuOpen, setLinkMenuOpen] = useState(false);
  const [linkSelection, setLinkSelection] = useState<Pick<Selection, "from" | "to"> | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          enableClickSelection: true,
          autolink: true,
          linkOnPaste: true,
          HTMLAttributes: {
            class: "editor-link",
            target: null,
            rel: null,
          },
        },
      }),
      Placeholder.configure({
        placeholder: ({ editor: currentEditor }) =>
          currentEditor.isEmpty ? placeholder : "",
      }),
      Focus.configure({
        className: "has-focus",
        mode: "deepest",
      }),
      SlashCommands,
    ],
    content: "",
    autofocus,
    editorProps: {
      attributes: {
        class: cn(
          "tiptap-editor prose prose-neutral dark:prose-invert max-w-none outline-none min-h-[calc(100vh-8rem)] px-5 pt-8 sm:px-6",
          contentClassName
        ),
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
    onUpdate: ({ editor: currentEditor }) => {
      onContentChange(currentEditor.getHTML());
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
    enableFileCommands: enableFileShortcuts,
  });

  useEffect(() => {
    onEditorReady?.(editor);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!editor || initialContentAppliedRef.current) return;

    if (content) {
      editor.commands.setContent(content, { emitUpdate: false });
    }

    initialContentAppliedRef.current = true;
  }, [content, editor]);

  useEffect(() => {
    if (!editor || !initialContentAppliedRef.current) return;
    if (content === editor.getHTML()) return;

    editor.commands.setContent(content, { emitUpdate: false });
  }, [content, editor]);

  const handleContainerClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;

      if (editor && !editor.isFocused) {
        editor.commands.focus("end");
      }
    },
    [editor]
  );

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
        "w-full flex-1 cursor-text",
        focusMode && "focus-mode",
        font === "editorial" && "font-editorial",
        font === "classic" && "font-classic",
        font === "mono" && "font-mono",
        font === "sans" && "font-sans",
        containerClassName
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
