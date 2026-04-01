"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Editor } from "@tiptap/core";
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
  CopyCheckIcon,
  CodeSimpleIcon,
  FileCodeIcon,
  Link01Icon,
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  CheckmarkSquare02Icon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  LeftToRightBlockQuoteIcon,
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

export function EditorBubbleMenu({
  editor,
  linkOpen,
  onLinkOpenChange,
  savedSelection,
}: EditorBubbleMenuProps) {
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  const [showCopyConfirmation, setShowCopyConfirmation] = useState(false);
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
      isHeading1: currentEditor?.isActive("heading", { level: 1 }) ?? false,
      isHeading2: currentEditor?.isActive("heading", { level: 2 }) ?? false,
      isHeading3: currentEditor?.isActive("heading", { level: 3 }) ?? false,
      isBulletList: currentEditor?.isActive("bulletList") ?? false,
      isOrderedList: currentEditor?.isActive("orderedList") ?? false,
      isTaskList: currentEditor?.isActive("taskList") ?? false,
      isBlockquote: currentEditor?.isActive("blockquote") ?? false,
      isCodeBlock: currentEditor?.isActive("codeBlock") ?? false,
      isLink: currentEditor?.isActive("link") ?? false,
    }),
  });
  const activeLinkUrl = editorState?.activeLinkUrl ?? "";
  const isLinkActive = editorState?.isLink ?? false;
  const linkUrl = linkDraft ?? activeLinkUrl;

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

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: currentEditor, from, to }) =>
        linkOpen || currentEditor.isActive("link") || from !== to
      }
      className="flex max-w-[calc(100vw-1rem)] flex-wrap items-center gap-0.5 rounded-xl border border-border bg-background p-1 shadow-lg sm:max-w-none sm:flex-nowrap"
      onMouseDown={(event) => event.preventDefault()}
    >
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
          icon={showCopyConfirmation ? CopyCheckIcon : Copy01Icon}
          size={16}
          strokeWidth={2}
        />
      </Button>

      <Separator orientation="vertical" className="mx-0.5 h-5" />

      {/* Inline formatting */}
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

      {/* Headings */}
      <Toggle
        size="sm"
        className="px-2 sm:px-3"
        pressed={editorState?.isHeading1}
        onPressedChange={() => focusEditor().toggleHeading({ level: 1 }).run()}
        aria-label="Heading 1"
      >
        <HugeiconsIcon icon={Heading01Icon} size={16} strokeWidth={2} />
      </Toggle>
      <Toggle
        size="sm"
        className="px-2 sm:px-3"
        pressed={editorState?.isHeading2}
        onPressedChange={() => focusEditor().toggleHeading({ level: 2 }).run()}
        aria-label="Heading 2"
      >
        <HugeiconsIcon icon={Heading02Icon} size={16} strokeWidth={2} />
      </Toggle>
      <Toggle
        size="sm"
        className="px-2 sm:px-3"
        pressed={editorState?.isHeading3}
        onPressedChange={() => focusEditor().toggleHeading({ level: 3 }).run()}
        aria-label="Heading 3"
      >
        <HugeiconsIcon icon={Heading03Icon} size={16} strokeWidth={2} />
      </Toggle>

      <Separator orientation="vertical" className="mx-0.5 h-5" />

      {/* Block formatting */}
      <Toggle
        size="sm"
        className="px-2 sm:px-3"
        pressed={editorState?.isBulletList}
        onPressedChange={() => focusEditor().toggleBulletList().run()}
        aria-label="Bullet list"
      >
        <HugeiconsIcon
          icon={LeftToRightListBulletIcon}
          size={16}
          strokeWidth={2}
        />
      </Toggle>
      <Toggle
        size="sm"
        className="px-2 sm:px-3"
        pressed={editorState?.isOrderedList}
        onPressedChange={() => focusEditor().toggleOrderedList().run()}
        aria-label="Numbered list"
      >
        <HugeiconsIcon
          icon={LeftToRightListNumberIcon}
          size={16}
          strokeWidth={2}
        />
      </Toggle>
      <Toggle
        size="sm"
        className="px-2 sm:px-3"
        pressed={editorState?.isTaskList}
        onPressedChange={() => focusEditor().toggleTaskList().run()}
        aria-label="Task list"
      >
        <HugeiconsIcon
          icon={CheckmarkSquare02Icon}
          size={16}
          strokeWidth={2}
        />
      </Toggle>
      <Toggle
        size="sm"
        className="px-2 sm:px-3"
        pressed={editorState?.isBlockquote}
        onPressedChange={() => focusEditor().toggleBlockquote().run()}
        aria-label="Blockquote"
      >
        <HugeiconsIcon
          icon={LeftToRightBlockQuoteIcon}
          size={16}
          strokeWidth={2}
        />
      </Toggle>
      <Toggle
        size="sm"
        className="px-2 sm:px-3"
        pressed={editorState?.isCodeBlock}
        onPressedChange={() => focusEditor().toggleCodeBlock().run()}
        aria-label="Code block"
      >
        <HugeiconsIcon icon={FileCodeIcon} size={16} strokeWidth={2} />
      </Toggle>

      <Separator orientation="vertical" className="mx-0.5 h-5" />

      {/* Link */}
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
    </BubbleMenu>
  );
}
