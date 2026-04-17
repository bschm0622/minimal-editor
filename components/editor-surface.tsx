"use client";

import {
  useEffect,
  useCallback,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import {
  Extension,
  findParentNodeClosestToPos,
  type Editor,
} from "@tiptap/core";
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model";
import type { Selection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions/placeholder";
import { Focus } from "@tiptap/extensions/focus";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import type { EditorFont } from "@/lib/editor-store";
import {
  looksLikeMarkdown,
  markdownToHtml,
  normalizeMarkdownPaste,
  tabularTextToHtml,
} from "@/lib/markdown";
import { useEditorKeyboardShortcuts } from "@/lib/use-editor-keyboard-shortcuts";
import { cn } from "@/lib/utils";
import { EditorBubbleMenu } from "./editor-bubble-menu";
import { SlashCommands } from "./slash-command";

const TableEditingShortcuts = Extension.create({
  name: "tableEditingShortcuts",
  priority: 1000,
  addKeyboardShortcuts() {
    const deleteEmptyRow = () => {
      const { selection } = this.editor.state;

      if (!selection.empty) {
        return false;
      }

      const cell = findParentNodeClosestToPos(
        selection.$from,
        (node) =>
          node.type.name === "tableCell" || node.type.name === "tableHeader"
      );
      const row = findParentNodeClosestToPos(
        selection.$from,
        (node) => node.type.name === "tableRow"
      );

      if (!cell || !row) {
        return false;
      }

      if (cell.node.textContent.trim() !== "" || row.node.textContent.trim() !== "") {
        return false;
      }

      return this.editor.commands.deleteRow();
    };

    return {
      Backspace: deleteEmptyRow,
      Delete: deleteEmptyRow,
    };
  },
});

type EditorSurfaceProps = {
  content: string;
  onContentChange: (content: string) => void;
  onEditorReady?: (editor: Editor | null) => void;
  placeholder?: string;
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
      Table.configure({
        resizable: false,
        HTMLAttributes: {
          class: "editor-table",
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      TableEditingShortcuts,
      SlashCommands,
    ],
    content: "",
    editorProps: {
      attributes: {
        class: cn(
          "tiptap-editor prose prose-neutral dark:prose-invert max-w-none outline-none min-h-[calc(100vh-8rem)] px-5 pt-8 sm:px-6",
          contentClassName
        ),
      },
      handlePaste(view, event) {
        const plainText = event.clipboardData?.getData("text/plain") ?? "";
        const html = event.clipboardData?.getData("text/html") ?? "";

        if (html.includes("<table")) {
          return false;
        }

        const pasteHtml = looksLikeMarkdown(plainText)
          ? markdownToHtml(normalizeMarkdownPaste(plainText))
          : tabularTextToHtml(plainText);

        if (!pasteHtml) {
          return false;
        }

        const wrapper = document.createElement("div");
        wrapper.innerHTML = pasteHtml;
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
