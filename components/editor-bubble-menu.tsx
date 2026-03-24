"use client";

import { useState, useCallback } from "react";
import type { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  TextBoldIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  TextUnderlineIcon,
  CodeIcon,
  Link01Icon,
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  LeftToRightBlockQuoteIcon,
  SourceCodeSquareIcon,
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

export function EditorBubbleMenu({ editor }: { editor: Editor }) {
  const [linkUrl, setLinkUrl] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);

  const setLink = useCallback(() => {
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setLinkOpen(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  const openLinkPopover = useCallback(() => {
    const existing = editor.getAttributes("link").href || "";
    setLinkUrl(existing);
    setLinkOpen(true);
  }, [editor]);

  return (
    <BubbleMenu
      editor={editor}
      className="flex items-center gap-0.5 rounded-xl border border-border bg-background p-1 shadow-lg"
    >
      {/* Inline formatting */}
      <Toggle
        size="sm"
        pressed={editor.isActive("bold")}
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
        aria-label="Bold"
      >
        <HugeiconsIcon icon={TextBoldIcon} size={16} strokeWidth={2} />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("italic")}
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        aria-label="Italic"
      >
        <HugeiconsIcon icon={TextItalicIcon} size={16} strokeWidth={2} />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("underline")}
        onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
        aria-label="Underline"
      >
        <HugeiconsIcon icon={TextUnderlineIcon} size={16} strokeWidth={2} />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("strike")}
        onPressedChange={() => editor.chain().focus().toggleStrike().run()}
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
        pressed={editor.isActive("code")}
        onPressedChange={() => editor.chain().focus().toggleCode().run()}
        aria-label="Inline code"
      >
        <HugeiconsIcon icon={CodeIcon} size={16} strokeWidth={2} />
      </Toggle>

      <Separator orientation="vertical" className="mx-0.5 h-5" />

      {/* Headings */}
      <Toggle
        size="sm"
        pressed={editor.isActive("heading", { level: 1 })}
        onPressedChange={() =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }
        aria-label="Heading 1"
      >
        <HugeiconsIcon icon={Heading01Icon} size={16} strokeWidth={2} />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("heading", { level: 2 })}
        onPressedChange={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
        aria-label="Heading 2"
      >
        <HugeiconsIcon icon={Heading02Icon} size={16} strokeWidth={2} />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("heading", { level: 3 })}
        onPressedChange={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
        aria-label="Heading 3"
      >
        <HugeiconsIcon icon={Heading03Icon} size={16} strokeWidth={2} />
      </Toggle>

      <Separator orientation="vertical" className="mx-0.5 h-5" />

      {/* Block formatting */}
      <Toggle
        size="sm"
        pressed={editor.isActive("bulletList")}
        onPressedChange={() =>
          editor.chain().focus().toggleBulletList().run()
        }
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
        pressed={editor.isActive("orderedList")}
        onPressedChange={() =>
          editor.chain().focus().toggleOrderedList().run()
        }
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
        pressed={editor.isActive("blockquote")}
        onPressedChange={() =>
          editor.chain().focus().toggleBlockquote().run()
        }
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
        pressed={editor.isActive("codeBlock")}
        onPressedChange={() =>
          editor.chain().focus().toggleCodeBlock().run()
        }
        aria-label="Code block"
      >
        <HugeiconsIcon
          icon={SourceCodeSquareIcon}
          size={16}
          strokeWidth={2}
        />
      </Toggle>

      <Separator orientation="vertical" className="mx-0.5 h-5" />

      {/* Link */}
      <Popover open={linkOpen} onOpenChange={setLinkOpen}>
        <PopoverTrigger
          render={
            <Toggle
              size="sm"
              pressed={editor.isActive("link")}
              onPressedChange={openLinkPopover}
              aria-label="Link"
            />
          }
        >
          <HugeiconsIcon icon={Link01Icon} size={16} strokeWidth={2} />
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" side="bottom">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setLink();
            }}
            className="flex gap-2"
          >
            <Input
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="h-8 text-sm"
              autoFocus
            />
            <Button size="sm" type="submit" className="h-8">
              Set
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </BubbleMenu>
  );
}
