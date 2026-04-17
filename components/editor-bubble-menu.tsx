"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { findParentNodeClosestToPos, type Editor } from "@tiptap/core";
import type { Selection } from "@tiptap/pm/state";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  TextBoldIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  TextUnderlineIcon,
  Copy01Icon,
  Tick02Icon,
  CodeSimpleIcon,
  Link01Icon,
  TableIcon,
  InsertColumnLeftIcon,
  InsertColumnRightIcon,
  InsertRowUpIcon,
  InsertRowDownIcon,
  DeleteColumnIcon,
  DeleteRowIcon,
  Delete01Icon,
  TableRowsSplitIcon,
} from "@hugeicons/core-free-icons";
import { Toggle } from "@/components/ui/toggle";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { copyEditorSelectionAsMarkdown } from "@/lib/editor-file-actions";

function normalizeLinkUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return "";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;

  return `https://${trimmed}`;
}

type EditorBubbleMenuProps = {
  editor: Editor;
  linkOpen: boolean;
  onLinkOpenChange: (open: boolean) => void;
  savedSelection: Pick<Selection, "from" | "to"> | null;
};

type EditorChain = ReturnType<Editor["chain"]>;
type TableButtonPosition = { top: number; right: number };

function getActiveTableWrapper(editor: Editor) {
  const table = findParentNodeClosestToPos(
    editor.state.selection.$from,
    (node) => node.type.name === "table"
  );

  if (!table) {
    return null;
  }

  const tableDom = editor.view.nodeDOM(table.pos);

  return tableDom instanceof HTMLElement ? tableDom : null;
}

function getTableButtonPosition(editor: Editor): TableButtonPosition | null {
  const wrapper = getActiveTableWrapper(editor);

  if (!wrapper) {
    return null;
  }

  const rect = wrapper.getBoundingClientRect();

  return {
    top: rect.bottom - 10,
    right: window.innerWidth - rect.right + 10,
  };
}

export function EditorBubbleMenu({
  editor,
  linkOpen,
  onLinkOpenChange,
  savedSelection,
}: EditorBubbleMenuProps) {
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  const [showCopyConfirmation, setShowCopyConfirmation] = useState(false);
  const [tableMenuOpen, setTableMenuOpen] = useState(false);
  const [tableButtonPosition, setTableButtonPosition] =
    useState<TableButtonPosition | null>(null);
  const selectionRef = useRef<Pick<Selection, "from" | "to"> | null>(null);
  const linkInputRef = useRef<HTMLInputElement | null>(null);
  const focusEditor = useCallback(
    () => editor.chain().focus(undefined, { scrollIntoView: false }),
    [editor]
  );
  const editorState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      activeLinkUrl: currentEditor?.getAttributes("link").href || "",
      isBold: currentEditor?.isActive("bold") ?? false,
      isItalic: currentEditor?.isActive("italic") ?? false,
      isUnderline: currentEditor?.isActive("underline") ?? false,
      isStrike: currentEditor?.isActive("strike") ?? false,
      isCode: currentEditor?.isActive("code") ?? false,
      isLink: currentEditor?.isActive("link") ?? false,
      isTable: currentEditor?.isActive("table") ?? false,
      isSelectionEmpty: currentEditor?.state.selection.empty ?? true,
      canAddColumnBefore: currentEditor
        ? currentEditor.can().addColumnBefore()
        : false,
      canAddColumnAfter: currentEditor
        ? currentEditor.can().addColumnAfter()
        : false,
      canDeleteColumn: currentEditor ? currentEditor.can().deleteColumn() : false,
      canAddRowBefore: currentEditor ? currentEditor.can().addRowBefore() : false,
      canAddRowAfter: currentEditor ? currentEditor.can().addRowAfter() : false,
      canDeleteRow: currentEditor ? currentEditor.can().deleteRow() : false,
      canDeleteTable: currentEditor ? currentEditor.can().deleteTable() : false,
      canToggleHeaderRow: currentEditor
        ? currentEditor.can().toggleHeaderRow()
        : false,
      hasHeaderRow: currentEditor?.isActive("tableHeader") ?? false,
    }),
  });
  const activeLinkUrl = editorState?.activeLinkUrl ?? "";
  const isLinkActive = editorState?.isLink ?? false;
  const linkUrl = linkDraft ?? activeLinkUrl;
  const showFormattingControls =
    linkOpen || isLinkActive || !(editorState?.isSelectionEmpty ?? true);
  const showTableControls = editorState?.isTable ?? false;

  const runTableCommand = useCallback(
    (
      command: (chain: EditorChain) => EditorChain,
      options?: { closeMenu?: boolean }
    ) => {
      command(focusEditor()).run();

      if (options?.closeMenu) {
        setTableMenuOpen(false);
      }
    },
    [focusEditor]
  );

  useEffect(() => {
    if (!linkOpen) return;

    const focusInput = window.requestAnimationFrame(() => {
      linkInputRef.current?.focus({ preventScroll: true });
      linkInputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(focusInput);
  }, [linkOpen]);

  const rememberSelection = useCallback(() => {
    const { from, to } = editor.state.selection;
    selectionRef.current = { from, to };
  }, [editor]);

  const getSelectionToRestore = useCallback(
    () => selectionRef.current ?? savedSelection,
    [savedSelection]
  );

  const setLink = useCallback(() => {
    const normalizedUrl = normalizeLinkUrl(linkUrl);
    const selection = getSelectionToRestore();
    const chain = focusEditor();

    if (selection) {
      chain.setTextSelection(selection);
    }

    if (normalizedUrl) {
      chain.extendMarkRange("link").setLink({ href: normalizedUrl }).run();
    } else {
      chain.extendMarkRange("link").unsetLink().run();
    }

    selectionRef.current = null;
    setLinkDraft(null);
    onLinkOpenChange(false);
  }, [focusEditor, getSelectionToRestore, linkUrl, onLinkOpenChange]);

  const removeLink = useCallback(() => {
    const selection = getSelectionToRestore();
    const chain = focusEditor();

    if (selection) {
      chain.setTextSelection(selection);
    }

    chain.extendMarkRange("link").unsetLink().run();

    selectionRef.current = null;
    setLinkDraft(null);
    onLinkOpenChange(false);
  }, [focusEditor, getSelectionToRestore, onLinkOpenChange]);

  const handleLinkOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        selectionRef.current = null;
        setLinkDraft(null);
      }
      onLinkOpenChange(open);
    },
    [onLinkOpenChange]
  );

  const openLinkPopover = useCallback(() => {
    rememberSelection();
    setLinkDraft(null);
    onLinkOpenChange(true);
  }, [onLinkOpenChange, rememberSelection]);

  const copySelection = useCallback(async () => {
    if (!(await copyEditorSelectionAsMarkdown(editor))) {
      return;
    }

    setShowCopyConfirmation(true);
  }, [editor]);

  useEffect(() => {
    if (!showCopyConfirmation) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowCopyConfirmation(false);
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [showCopyConfirmation]);

  useEffect(() => {
    let frameId: number | null = null;

    const updateTableButtonPosition = () => {
      frameId = null;
      if (!editor.isEditable || !editor.isActive("table")) {
        setTableButtonPosition(null);
        return;
      }
      setTableButtonPosition(getTableButtonPosition(editor));
    };

    const scheduleUpdate = () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(updateTableButtonPosition);
    };

    updateTableButtonPosition();

    editor.on("selectionUpdate", scheduleUpdate);
    editor.on("transaction", scheduleUpdate);
    editor.on("focus", scheduleUpdate);
    editor.on("blur", scheduleUpdate);
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      editor.off("selectionUpdate", scheduleUpdate);
      editor.off("transaction", scheduleUpdate);
      editor.off("focus", scheduleUpdate);
      editor.off("blur", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
    };
  }, [editor]);

  return (
    <>
      <BubbleMenu
        editor={editor}
        shouldShow={({ editor: currentEditor, from, to }) =>
          linkOpen || currentEditor.isActive("link") || from !== to
        }
        options={{
          strategy: "fixed",
          placement: "top",
          offset: 8,
          flip: {
            fallbackPlacements: ["bottom", "top"],
          },
          shift: {
            padding: {
              top: 72,
              right: 8,
              bottom: 8,
              left: 8,
            },
          },
        }}
        className="z-[60] flex max-w-[calc(100vw-1rem)] flex-wrap items-center gap-0.5 rounded-xl border border-border bg-background p-1 shadow-lg sm:max-w-none sm:flex-nowrap"
        onMouseDown={(event) => event.preventDefault()}
      >
      {showFormattingControls ? (
        <>
          <Button
            size="icon-sm"
            variant="outline"
            className="size-8"
            onClick={copySelection}
            aria-label={
              showCopyConfirmation
                ? "Copied selection as Markdown"
                : "Copy selection as Markdown"
            }
            title={
              showCopyConfirmation
                ? "Copied selection as Markdown"
                : "Copy selection as Markdown"
            }
          >
            <HugeiconsIcon
              icon={showCopyConfirmation ? Tick02Icon : Copy01Icon}
              size={16}
              strokeWidth={2}
            />
          </Button>

          <Separator orientation="vertical" className="mx-0.5 h-5" />

          <Toggle
            size="sm"
            className="px-2 sm:px-3"
            pressed={editorState?.isBold}
            onPressedChange={() => focusEditor().toggleBold().run()}
            aria-label="Bold"
          >
            <HugeiconsIcon icon={TextBoldIcon} size={16} strokeWidth={2} />
          </Toggle>
          <Toggle
            size="sm"
            className="px-2 sm:px-3"
            pressed={editorState?.isItalic}
            onPressedChange={() => focusEditor().toggleItalic().run()}
            aria-label="Italic"
          >
            <HugeiconsIcon icon={TextItalicIcon} size={16} strokeWidth={2} />
          </Toggle>
          <Toggle
            size="sm"
            className="px-2 sm:px-3"
            pressed={editorState?.isUnderline}
            onPressedChange={() => focusEditor().toggleUnderline().run()}
            aria-label="Underline"
          >
            <HugeiconsIcon icon={TextUnderlineIcon} size={16} strokeWidth={2} />
          </Toggle>
          <Toggle
            size="sm"
            className="px-2 sm:px-3"
            pressed={editorState?.isStrike}
            onPressedChange={() => focusEditor().toggleStrike().run()}
            aria-label="Strikethrough"
          >
            <HugeiconsIcon
              icon={TextStrikethroughIcon}
              size={16}
              strokeWidth={2}
            />
          </Toggle>
          <Toggle
            size="sm"
            className="px-2 sm:px-3"
            pressed={editorState?.isCode}
            onPressedChange={() => focusEditor().toggleCode().run()}
            aria-label="Inline code"
          >
            <HugeiconsIcon icon={CodeSimpleIcon} size={16} strokeWidth={2} />
          </Toggle>

          <Separator orientation="vertical" className="mx-0.5 h-5" />

          <Popover open={linkOpen} onOpenChange={handleLinkOpenChange}>
            <PopoverTrigger
              render={
                <Toggle
                  size="sm"
                  className="px-2 sm:px-3"
                  pressed={isLinkActive}
                  onPressedChange={openLinkPopover}
                  aria-label="Link"
                />
              }
            >
              <HugeiconsIcon icon={Link01Icon} size={16} strokeWidth={2} />
            </PopoverTrigger>
            <PopoverContent
              className="w-[min(18rem,calc(100vw-1.5rem))] p-3 sm:w-72"
              side="bottom"
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setLink();
                }}
                className="flex gap-2"
              >
                <Input
                  ref={linkInputRef}
                  placeholder="Paste or type a URL"
                  value={linkUrl}
                  onChange={(e) => setLinkDraft(e.target.value)}
                  className="h-8 text-sm"
                />
                <Button size="sm" type="submit" className="h-8">
                  Save
                </Button>
                {activeLinkUrl ? (
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    className="h-8"
                    onClick={removeLink}
                  >
                    Remove
                  </Button>
                ) : null}
              </form>
            </PopoverContent>
          </Popover>
          {activeLinkUrl ? (
            <button
              type="button"
              className="max-w-28 truncate rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:max-w-36 sm:px-3"
              onClick={openLinkPopover}
              title={activeLinkUrl}
            >
              {activeLinkUrl}
            </button>
          ) : null}
        </>
      ) : null}

      </BubbleMenu>

      {showTableControls && tableButtonPosition ? (
        <div
          className="fixed z-[70]"
          style={{
            top: tableButtonPosition.top,
            right: tableButtonPosition.right,
            transform: "translateY(-100%)",
          }}
          onMouseDown={(event) => event.preventDefault()}
        >
          <Popover
            open={showTableControls && tableMenuOpen}
            onOpenChange={setTableMenuOpen}
          >
            <PopoverTrigger
              render={
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 rounded-full border-border/70 bg-background/92 px-3 text-xs text-foreground shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/78"
                  aria-label="Table options"
                />
              }
            >
              <HugeiconsIcon icon={TableIcon} size={14} strokeWidth={2} />
              Table
            </PopoverTrigger>
            <PopoverContent
              className="w-64 gap-2 p-2.5"
              side="top"
              align="end"
              sideOffset={10}
            >
              <div className="px-1 pt-0.5 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                Structure
              </div>
              <div className="grid grid-cols-2 gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 justify-start rounded-xl"
                  disabled={!editorState?.canToggleHeaderRow}
                  onClick={() => runTableCommand((chain) => chain.toggleHeaderRow())}
                >
                  <HugeiconsIcon icon={TableRowsSplitIcon} size={15} strokeWidth={1.8} />
                  Header row
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 justify-start rounded-xl"
                  disabled={!editorState?.canDeleteTable}
                  onClick={() =>
                    runTableCommand((chain) => chain.deleteTable(), {
                      closeMenu: true,
                    })
                  }
                >
                  <HugeiconsIcon icon={Delete01Icon} size={15} strokeWidth={1.8} />
                  Clear table
                </Button>
              </div>
              <div className="px-1 pt-1 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                Insert
              </div>
              <div className="grid grid-cols-2 gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 justify-start rounded-xl"
                  disabled={!editorState?.canAddRowBefore}
                  onClick={() => runTableCommand((chain) => chain.addRowBefore())}
                >
                  <HugeiconsIcon icon={InsertRowUpIcon} size={15} strokeWidth={1.8} />
                  Row above
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 justify-start rounded-xl"
                  disabled={!editorState?.canAddRowAfter}
                  onClick={() => runTableCommand((chain) => chain.addRowAfter())}
                >
                  <HugeiconsIcon icon={InsertRowDownIcon} size={15} strokeWidth={1.8} />
                  Row below
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 justify-start rounded-xl"
                  disabled={!editorState?.canAddColumnBefore}
                  onClick={() => runTableCommand((chain) => chain.addColumnBefore())}
                >
                  <HugeiconsIcon icon={InsertColumnLeftIcon} size={15} strokeWidth={1.8} />
                  Col left
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 justify-start rounded-xl"
                  disabled={!editorState?.canAddColumnAfter}
                  onClick={() => runTableCommand((chain) => chain.addColumnAfter())}
                >
                  <HugeiconsIcon icon={InsertColumnRightIcon} size={15} strokeWidth={1.8} />
                  Col right
                </Button>
              </div>
              <div className="px-1 pt-1 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                Delete
              </div>
              <div className="grid grid-cols-2 gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 justify-start rounded-xl text-destructive hover:text-destructive"
                  disabled={!editorState?.canDeleteRow}
                  onClick={() => runTableCommand((chain) => chain.deleteRow())}
                >
                  <HugeiconsIcon icon={DeleteRowIcon} size={15} strokeWidth={1.8} />
                  Delete row
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 justify-start rounded-xl text-destructive hover:text-destructive"
                  disabled={!editorState?.canDeleteColumn}
                  onClick={() => runTableCommand((chain) => chain.deleteColumn())}
                >
                  <HugeiconsIcon icon={DeleteColumnIcon} size={15} strokeWidth={1.8} />
                  Delete col
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      ) : null}
    </>
  );
}
