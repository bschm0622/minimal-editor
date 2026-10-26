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
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
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
  Layers01Icon,
  ViewOffIcon,
  EyeIcon,
  LeftToRightListBulletIcon,
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
import {
  alternativeInSelection,
  canAddAlternative,
  dimmedInSelection,
  dimSelection,
  undim,
} from "@/lib/alternatives";
import { showVersions, startAlternativeFromSelection } from "@/lib/alternatives-ui";
import { announce } from "@/lib/announce";
import { ALT_KEY, cn, MOD_KEY } from "@/lib/utils";

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

function TableMenuButton({
  icon,
  destructive,
  children,
  ...props
}: {
  icon: IconSvgElement;
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className={cn(
        "justify-start rounded-xl px-2.5 font-normal",
        destructive && "text-destructive hover:text-destructive"
      )}
      {...props}
    >
      <HugeiconsIcon icon={icon} size={16} strokeWidth={1.75} />
      {children}
    </Button>
  );
}

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
      selectedAlternative: currentEditor
        ? alternativeInSelection(currentEditor.state)
        : null,
      hasDimmed: currentEditor
        ? dimmedInSelection(currentEditor.state).length > 0
        : false,
      canAddAlternative: currentEditor
        ? canAddAlternative(
            currentEditor.state,
            currentEditor.state.selection.from,
            currentEditor.state.selection.to
          )
        : false,
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
    announce("Copied as Markdown");
  }, [editor]);

  const copyLinkUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(activeLinkUrl);
      setShowCopyConfirmation(true);
      announce("Copied link");
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
        tabIndex={-1}
        className={
          menuMode === "handle"
            ? "z-[60] flex items-center gap-0.5 rounded-full border border-border bg-popover p-0.5 shadow-lg"
            : "z-[60] flex max-w-[calc(100vw-1rem)] flex-wrap items-center gap-0.5 rounded-2xl border border-border bg-popover p-1 shadow-lg sm:max-w-none sm:flex-nowrap sm:rounded-full"
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
                className="flex h-8 max-w-56 items-center gap-1.5 rounded-full px-3 text-sm text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:max-w-72"
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
            {editorState?.canAddAlternative ? (
              <MenuTooltip label="Add alternative" shortcut={`${ALT_KEY}↵`}>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="size-7 rounded-full"
                  onClick={() => startAlternativeFromSelection(editor)}
                  aria-label="Add alternative"
                >
                  <HugeiconsIcon icon={Layers01Icon} size={15} strokeWidth={2} />
                </Button>
              </MenuTooltip>
            ) : null}
            {editorState?.canAddAlternative ? (
              <MenuTooltip label="Dim" shortcut={`${ALT_KEY}D`}>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="size-7 rounded-full"
                  onClick={() => dimSelection(editor)}
                  aria-label="Dim"
                >
                  <HugeiconsIcon icon={ViewOffIcon} size={15} strokeWidth={2} />
                </Button>
              </MenuTooltip>
            ) : null}
            {editorState?.selectedAlternative ? (
              <MenuTooltip label="Show versions" shortcut={`${ALT_KEY}↵`}>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="size-7 rounded-full"
                  onClick={() => showVersions(editor, editorState.selectedAlternative!)}
                  aria-label="Show versions"
                >
                  <HugeiconsIcon icon={LeftToRightListBulletIcon} size={15} strokeWidth={2} />
                </Button>
              </MenuTooltip>
            ) : null}
            {editorState?.hasDimmed ? (
              <MenuTooltip label="Undim" shortcut={`${ALT_KEY}D`}>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="size-7 rounded-full"
                  onClick={() => undim(editor, dimmedInSelection(editor.state))}
                  aria-label="Undim"
                >
                  <HugeiconsIcon icon={EyeIcon} size={15} strokeWidth={2} />
                </Button>
              </MenuTooltip>
            ) : null}
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
                  className="gap-1.5 bg-popover px-3 text-xs shadow-sm"
                  aria-label="Table options"
                />
              }
            >
              <HugeiconsIcon icon={TableIcon} size={14} strokeWidth={2} />
              Table
            </PopoverTrigger>
            <PopoverContent
              className="w-72 gap-1 p-1"
              side="top"
              align="end"
              sideOffset={8}
            >
              <div className="grid grid-cols-2 gap-1">
                <TableMenuButton
                  icon={InsertRowUpIcon}
                  disabled={!editorState?.canAddRowBefore}
                  onClick={() => runTableCommand((chain) => chain.addRowBefore())}
                >
                  Row above
                </TableMenuButton>
                <TableMenuButton
                  icon={InsertRowDownIcon}
                  disabled={!editorState?.canAddRowAfter}
                  onClick={() => runTableCommand((chain) => chain.addRowAfter())}
                >
                  Row below
                </TableMenuButton>
                <TableMenuButton
                  icon={InsertColumnLeftIcon}
                  disabled={!editorState?.canAddColumnBefore}
                  onClick={() => runTableCommand((chain) => chain.addColumnBefore())}
                >
                  Column left
                </TableMenuButton>
                <TableMenuButton
                  icon={InsertColumnRightIcon}
                  disabled={!editorState?.canAddColumnAfter}
                  onClick={() => runTableCommand((chain) => chain.addColumnAfter())}
                >
                  Column right
                </TableMenuButton>
                <TableMenuButton
                  icon={TableRowsSplitIcon}
                  disabled={!editorState?.canToggleHeaderRow}
                  onClick={() => runTableCommand((chain) => chain.toggleHeaderRow())}
                >
                  Header row
                </TableMenuButton>
              </div>
              <Separator className="my-0.5" />
              <div className="grid grid-cols-2 gap-1">
                <TableMenuButton
                  icon={DeleteRowIcon}
                  destructive
                  disabled={!editorState?.canDeleteRow}
                  onClick={() => runTableCommand((chain) => chain.deleteRow())}
                >
                  Delete row
                </TableMenuButton>
                <TableMenuButton
                  icon={DeleteColumnIcon}
                  destructive
                  disabled={!editorState?.canDeleteColumn}
                  onClick={() => runTableCommand((chain) => chain.deleteColumn())}
                >
                  Delete column
                </TableMenuButton>
                <TableMenuButton
                  icon={Delete01Icon}
                  destructive
                  disabled={!editorState?.canDeleteTable}
                  onClick={() =>
                    runTableCommand((chain) => chain.deleteTable(), {
                      closeMenu: true,
                    })
                  }
                >
                  Delete table
                </TableMenuButton>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      ) : null}
    </>
  );
}
