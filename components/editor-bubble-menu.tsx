"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  type ReactElement,
} from "react";
import { findParentNodeClosestToPos, type Editor } from "@tiptap/core";
import type { EditorState, Selection } from "@tiptap/pm/state";
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
  TextFontIcon,
  ArrowTurnBackwardIcon,
  CodeSimpleIcon,
  Link01Icon,
  LinkSquare02Icon,
  PencilEdit02Icon,
  Unlink02Icon,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { copyEditorSelectionAsMarkdown } from "@/lib/editor-copy-actions";

function normalizeLinkUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return "";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;

  return `https://${trimmed}`;
}

// Catches obvious non-links ("hello world", "notes") before they're saved.
function isValidLinkUrl(href: string) {
  if (/\s/.test(href)) return false;
  if (/^(mailto|tel):./i.test(href)) return true;

  try {
    const { hostname } = new URL(href);
    return hostname === "localhost" || /\.[a-z]{2,}$/i.test(hostname);
  } catch {
    return false;
  }
}

type EditorBubbleMenuProps = {
  editor: Editor;
  linkOpen: boolean;
  onLinkOpenChange: (open: boolean) => void;
};

const TRAILING_PUNCTUATION = /[.,;:!?)\]}"'”’]+$/;

// The word around an empty cursor, so Cmd+K can link it without a selection.
function getWordRangeAtCursor(state: EditorState) {
  const { $from } = state.selection;

  if (!$from.parent.isTextblock) return null;

  const text = $from.parent.textBetween(
    0,
    $from.parent.content.size,
    undefined,
    "\ufffc"
  );
  let start = $from.parentOffset;
  let end = start;

  while (start > 0 && /\S/.test(text[start - 1])) start--;
  while (end < text.length && /\S/.test(text[end])) end++;

  end -= text.slice(start, end).match(TRAILING_PUNCTUATION)?.[0].length ?? 0;

  if (start >= end) return null;

  return { from: $from.start() + start, to: $from.start() + end };
}

const MOD_KEY =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
    ? "⌘"
    : "Ctrl+";

function MenuTooltip({
  label,
  shortcut,
  children,
}: {
  label: string;
  shortcut?: string;
  children: ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent sideOffset={12}>
        {label}
        {shortcut ? (
          <span className="opacity-60">{shortcut}</span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

type EditorChain = ReturnType<Editor["chain"]>;
type BubbleMenuOptions = NonNullable<
  Parameters<typeof BubbleMenu>[0]["options"]
>;

const BUBBLE_MENU_PLUGIN_KEY = "bubbleMenu";

const BUBBLE_MENU_POSITION_OPTIONS: BubbleMenuOptions = {
  strategy: "fixed",
  placement: "top",
  offset: 8,
  flip: {
    fallbackPlacements: ["bottom", "top"],
    padding: { top: 72 },
  },
  shift: {
    padding: {
      top: 72,
      right: 8,
      bottom: 8,
      left: 8,
    },
  },
};
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
    top: rect.bottom + 8,
    right: window.innerWidth - rect.right + 10,
  };
}

export function EditorBubbleMenu({
  editor,
  linkOpen,
  onLinkOpenChange,
}: EditorBubbleMenuProps) {
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  const [linkInvalid, setLinkInvalid] = useState(false);
  // Selecting text shows a small handle; the full bar opens only on request.
  const [formatExpanded, setFormatExpanded] = useState(false);
  const [showCopyConfirmation, setShowCopyConfirmation] = useState(false);
  const [tableMenuOpen, setTableMenuOpen] = useState(false);
  const [tableButtonPosition, setTableButtonPosition] =
    useState<TableButtonPosition | null>(null);
  // Where the cursor was before editing a link, restored on Escape.
  const selectionBeforeLinkRef = useRef<Pick<Selection, "from" | "to"> | null>(
    null
  );
  const menuRef = useRef<HTMLDivElement | null>(null);
  const linkOpenRef = useRef(linkOpen);
  const linkInputRef = useRef<HTMLInputElement | null>(null);

  // The menu can show up to a beat after the link editor opens (the plugin
  // debounces non-empty selections), so focus the field once it's on screen.
  const focusLinkInput = useCallback(() => {
    window.requestAnimationFrame(() => {
      const input = linkInputRef.current;
      if (!linkOpenRef.current || !input?.isConnected) return;
      input.focus({ preventScroll: true });
      input.select();
    });
  }, []);
  // Stable so the BubbleMenu wrapper doesn't re-send options on every render.
  const bubbleMenuOptions = useMemo(
    () => ({ ...BUBBLE_MENU_POSITION_OPTIONS, onShow: focusLinkInput }),
    [focusLinkInput]
  );
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
  const isSelectionEmpty = editorState?.isSelectionEmpty ?? true;
  const linkUrl = linkDraft ?? activeLinkUrl;
  const menuMode = linkOpen
    ? "link-edit"
    : isLinkActive && isSelectionEmpty
      ? "link"
      : formatExpanded
        ? "format"
        : "handle";
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

  // Any new selection starts collapsed again. Formatting the current
  // selection doesn't move it, so the bar stays open while you work.
  useEffect(() => {
    const collapse = () => setFormatExpanded(false);
    editor.on("selectionUpdate", collapse);
    return () => {
      editor.off("selectionUpdate", collapse);
    };
  }, [editor]);

  useEffect(() => {
    if (!formatExpanded) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFormatExpanded(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [formatExpanded]);

  const shouldShowMenu = useCallback(
    ({ editor: currentEditor, from, to }: { editor: Editor; from: number; to: number }) =>
      linkOpenRef.current || currentEditor.isActive("link") || from !== to,
    []
  );

  // The plugin only re-checks shouldShow on selection changes and focus, so
  // opening the link field on an empty cursor needs a nudge to appear.
  const refreshMenuVisibility = useCallback(() => {
    if (editor.isDestroyed) return;
    editor.emit("focus", {
      editor,
      event: new FocusEvent("focus"),
      transaction: editor.state.tr,
    });
  }, [editor]);

  // The plugin positions the menu before React renders its new contents, so
  // a menu that grows after placement would spill over the text. Re-measure
  // whenever its size changes.
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const observer = new ResizeObserver(() => {
      if (editor.isDestroyed) return;
      editor.view.dispatch(
        editor.state.tr.setMeta(BUBBLE_MENU_PLUGIN_KEY, "updatePosition")
      );
    });

    observer.observe(menu);
    return () => observer.disconnect();
  }, [editor]);

  useLayoutEffect(() => {
    if (linkOpenRef.current === linkOpen) return;
    linkOpenRef.current = linkOpen;

    if (!linkOpen) {
      selectionBeforeLinkRef.current = null;
      refreshMenuVisibility();
      return;
    }

    const { state } = editor;
    const { from, to, empty } = state.selection;
    selectionBeforeLinkRef.current = { from, to };
    const word =
      empty && !editor.isActive("link") ? getWordRangeAtCursor(state) : null;

    if (word) {
      editor.chain().setTextSelection(word).run();
    } else {
      refreshMenuVisibility();
    }

    focusLinkInput();
  }, [editor, focusLinkInput, linkOpen, refreshMenuVisibility]);

  const openLinkEditor = useCallback(() => {
    onLinkOpenChange(true);
  }, [onLinkOpenChange]);

  const closeLinkEditor = useCallback(() => {
    setLinkDraft(null);
    setLinkInvalid(false);
    onLinkOpenChange(false);
  }, [onLinkOpenChange]);

  // Focus the editor before the field unmounts, so typing lands in the text.
  const returnToEditor = useCallback(() => {
    editor.view.focus();
    closeLinkEditor();
  }, [closeLinkEditor, editor]);

  const cancelLinkEdit = useCallback(() => {
    const selection = selectionBeforeLinkRef.current;

    if (selection) {
      editor.commands.setTextSelection(selection);
    }

    returnToEditor();
  }, [editor, returnToEditor]);

  const saveLink = useCallback(() => {
    const href = normalizeLinkUrl(linkUrl);

    if (href && !isValidLinkUrl(href)) {
      setLinkInvalid(true);
      linkInputRef.current?.focus();
      return;
    }

    const { empty } = editor.state.selection;
    const isInLink = editor.isActive("link");

    if (!href) {
      if (isInLink) {
        editor.chain().extendMarkRange("link").unsetLink().run();
      }
    } else if (empty && !isInLink) {
      editor
        .chain()
        .insertContent({
          type: "text",
          text: linkUrl.trim(),
          marks: [{ type: "link", attrs: { href } }],
        })
        .unsetMark("link")
        .run();
    } else {
      editor.chain().extendMarkRange("link").setLink({ href }).run();
      // Drop the cursor after the link so new typing isn't part of it.
      editor
        .chain()
        .setTextSelection(editor.state.selection.to)
        .unsetMark("link")
        .run();
    }

    returnToEditor();
  }, [editor, linkUrl, returnToEditor]);

  const removeLink = useCallback(() => {
    const { from } = editor.state.selection;
    focusEditor()
      .extendMarkRange("link")
      .unsetLink()
      .setTextSelection(from)
      .run();
  }, [editor, focusEditor]);

  const copySelection = useCallback(async () => {
    if (!(await copyEditorSelectionAsMarkdown(editor))) {
      return;
    }

    setShowCopyConfirmation(true);
  }, [editor]);

  const copyLinkUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(activeLinkUrl);
      setShowCopyConfirmation(true);
    } catch {
      // Clipboard access can be denied; nothing useful to show.
    }
  }, [activeLinkUrl]);

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
        ref={menuRef}
        editor={editor}
        pluginKey={BUBBLE_MENU_PLUGIN_KEY}
        // Show as soon as a selection exists, not after the default pause.
        updateDelay={0}
        shouldShow={shouldShowMenu}
        options={bubbleMenuOptions}
        className={
          menuMode === "handle"
            ? "z-[60] flex items-center gap-0.5 rounded-full border border-border bg-background p-0.5 shadow-md"
            : "z-[60] flex max-w-[calc(100vw-1rem)] flex-wrap items-center gap-0.5 rounded-xl border border-border bg-background p-1 shadow-lg sm:max-w-none sm:flex-nowrap"
        }
        onMouseDown={(event) => {
          // Keep the editor selection when clicking buttons, but let the
          // link field take focus.
          if (!(event.target instanceof HTMLInputElement)) {
            event.preventDefault();
          }
        }}
      >
        {menuMode === "link-edit" ? (
          <form
            className="flex items-center gap-1 pl-2"
            onSubmit={(event) => {
              event.preventDefault();
              saveLink();
            }}
          >
            <HugeiconsIcon
              icon={Link01Icon}
              size={16}
              strokeWidth={2}
              className="shrink-0 text-muted-foreground"
            />
            <Input
              ref={linkInputRef}
              aria-label="Link URL"
              placeholder="Paste or type a link"
              value={linkUrl}
              aria-invalid={linkInvalid || undefined}
              onChange={(event) => {
                setLinkDraft(event.target.value);
                setLinkInvalid(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelLinkEdit();
                }
              }}
              onBlur={(event) => {
                if (!menuRef.current?.contains(event.relatedTarget as Node)) {
                  closeLinkEditor();
                }
              }}
              className="h-8 w-56 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0 aria-invalid:text-destructive aria-invalid:ring-0 sm:w-72 dark:bg-transparent"
            />
            {linkInvalid ? (
              <span role="alert" className="shrink-0 px-1 text-xs text-destructive">
                Not a valid link
              </span>
            ) : null}
            <MenuTooltip label="Save link" shortcut="↵">
              <Button
                size="icon-sm"
                variant="ghost"
                type="submit"
                className="size-8"
                aria-label="Save link"
              >
                <HugeiconsIcon
                  icon={ArrowTurnBackwardIcon}
                  size={16}
                  strokeWidth={2}
                />
              </Button>
            </MenuTooltip>
          </form>
        ) : null}

        {menuMode === "link" ? (
          <>
            <MenuTooltip label="Open link" shortcut={`${MOD_KEY}click`}>
              <a
                href={activeLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 max-w-56 items-center gap-1.5 rounded-lg px-2.5 text-sm text-foreground transition-colors hover:bg-accent sm:max-w-72"
              >
                <span className="truncate">{activeLinkUrl}</span>
                <HugeiconsIcon
                  icon={LinkSquare02Icon}
                  size={14}
                  strokeWidth={2}
                  className="shrink-0 text-muted-foreground"
                />
              </a>
            </MenuTooltip>

            <Separator orientation="vertical" className="mx-0.5 h-5" />

            <MenuTooltip label={showCopyConfirmation ? "Copied" : "Copy link"}>
              <Button
                size="icon-sm"
                variant="ghost"
                className="size-8"
                onClick={copyLinkUrl}
                aria-label={showCopyConfirmation ? "Copied link" : "Copy link"}
              >
                <HugeiconsIcon
                  icon={showCopyConfirmation ? Tick02Icon : Copy01Icon}
                  size={16}
                  strokeWidth={2}
                />
              </Button>
            </MenuTooltip>
            <MenuTooltip label="Edit link" shortcut={`${MOD_KEY}K`}>
              <Button
                size="icon-sm"
                variant="ghost"
                className="size-8"
                onClick={openLinkEditor}
                aria-label="Edit link"
              >
                <HugeiconsIcon icon={PencilEdit02Icon} size={16} strokeWidth={2} />
              </Button>
            </MenuTooltip>
            <MenuTooltip label="Remove link">
              <Button
                size="icon-sm"
                variant="ghost"
                className="size-8"
                onClick={removeLink}
                aria-label="Remove link"
              >
                <HugeiconsIcon icon={Unlink02Icon} size={16} strokeWidth={2} />
              </Button>
            </MenuTooltip>
          </>
        ) : null}

        {menuMode === "handle" ? (
          <>
            <MenuTooltip label="Format">
              <Button
                size="icon-sm"
                variant="ghost"
                className="size-7 rounded-full"
                onClick={() => setFormatExpanded(true)}
                aria-label="Show formatting"
              >
                <HugeiconsIcon icon={TextFontIcon} size={15} strokeWidth={2} />
              </Button>
            </MenuTooltip>
            <MenuTooltip
              label={showCopyConfirmation ? "Copied" : "Copy as Markdown"}
            >
              <Button
                size="icon-sm"
                variant="ghost"
                className="size-7 rounded-full"
                onClick={copySelection}
                aria-label={
                  showCopyConfirmation
                    ? "Copied selection as Markdown"
                    : "Copy selection as Markdown"
                }
              >
                <HugeiconsIcon
                  icon={showCopyConfirmation ? Tick02Icon : Copy01Icon}
                  size={15}
                  strokeWidth={2}
                />
              </Button>
            </MenuTooltip>
          </>
        ) : null}

        {menuMode === "format" ? (
          <>
            <MenuTooltip label="Bold" shortcut={`${MOD_KEY}B`}>
              <Toggle
                size="sm"
                className="px-2 sm:px-3"
                pressed={editorState?.isBold}
                onPressedChange={() => focusEditor().toggleBold().run()}
                aria-label="Bold"
              >
                <HugeiconsIcon icon={TextBoldIcon} size={16} strokeWidth={2} />
              </Toggle>
            </MenuTooltip>
            <MenuTooltip label="Italic" shortcut={`${MOD_KEY}I`}>
              <Toggle
                size="sm"
                className="px-2 sm:px-3"
                pressed={editorState?.isItalic}
                onPressedChange={() => focusEditor().toggleItalic().run()}
                aria-label="Italic"
              >
                <HugeiconsIcon icon={TextItalicIcon} size={16} strokeWidth={2} />
              </Toggle>
            </MenuTooltip>
            <MenuTooltip label="Underline" shortcut={`${MOD_KEY}U`}>
              <Toggle
                size="sm"
                className="px-2 sm:px-3"
                pressed={editorState?.isUnderline}
                onPressedChange={() => focusEditor().toggleUnderline().run()}
                aria-label="Underline"
              >
                <HugeiconsIcon icon={TextUnderlineIcon} size={16} strokeWidth={2} />
              </Toggle>
            </MenuTooltip>
            <MenuTooltip label="Strikethrough" shortcut={`${MOD_KEY}⇧S`}>
              <Toggle
                size="sm"
                className="px-2 sm:px-3"
                pressed={editorState?.isStrike}
                onPressedChange={() => focusEditor().toggleStrike().run()}
                aria-label="Strikethrough"
              >
                <HugeiconsIcon icon={TextStrikethroughIcon} size={16} strokeWidth={2} />
              </Toggle>
            </MenuTooltip>
            <MenuTooltip label="Inline code" shortcut={`${MOD_KEY}E`}>
              <Toggle
                size="sm"
                className="px-2 sm:px-3"
                pressed={editorState?.isCode}
                onPressedChange={() => focusEditor().toggleCode().run()}
                aria-label="Inline code"
              >
                <HugeiconsIcon icon={CodeSimpleIcon} size={16} strokeWidth={2} />
              </Toggle>
            </MenuTooltip>

            <Separator orientation="vertical" className="mx-0.5 h-5" />

            <MenuTooltip
              label={isLinkActive ? "Edit link" : "Add link"}
              shortcut={`${MOD_KEY}K`}
            >
              <Toggle
                size="sm"
                className="px-2 sm:px-3"
                pressed={isLinkActive}
                onPressedChange={openLinkEditor}
                aria-label="Link"
              >
                <HugeiconsIcon icon={Link01Icon} size={16} strokeWidth={2} />
              </Toggle>
            </MenuTooltip>

            <Separator orientation="vertical" className="mx-0.5 h-5" />

            <MenuTooltip
              label={showCopyConfirmation ? "Copied" : "Copy as Markdown"}
            >
              <Toggle
                size="sm"
                className="px-2 sm:px-3"
                pressed={false}
                onPressedChange={copySelection}
                aria-label={
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
              </Toggle>
            </MenuTooltip>
          </>
        ) : null}
      </BubbleMenu>

      {showTableControls && tableButtonPosition ? (
        <div
          className="fixed z-[70]"
          style={{
            top: tableButtonPosition.top,
            right: tableButtonPosition.right,
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
