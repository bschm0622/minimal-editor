"use client";

import {
  Extension,
  type Editor,
  type Range,
} from "@tiptap/core";
import { createTable } from "@tiptap/extension-table";
import { TextSelection } from "@tiptap/pm/state";
import {
  FileCodeIcon,
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  LeftToRightBlockQuoteIcon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  MinusSignIcon,
  CheckmarkSquare02Icon,
  TableIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, {
  type SuggestionKeyDownProps,
  type SuggestionOptions,
} from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

interface CommandItem {
  title: string;
  description: string;
  aliases: string[];
  icon: IconSvgElement;
  command: (props: { editor: Editor; range: Range }) => void;
}

function applyCommand({
  editor,
  range,
  run,
}: {
  editor: Editor;
  range: Range;
  run: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>;
}) {
  return run(editor.chain().focus().deleteRange(range)).run();
}

function insertTableCommand({
  editor,
  rows = 3,
  cols = 3,
  withHeaderRow = true,
}: {
  editor: Editor;
  rows?: number;
  cols?: number;
  withHeaderRow?: boolean;
}) {
  const { selection } = editor.state;
  const { $from } = selection;
  const from = $from.parent.type.name === "paragraph" ? $from.before() : selection.from;
  const to = $from.parent.type.name === "paragraph" ? $from.after() : selection.to;
  const table = createTable(editor.schema, rows, cols, withHeaderRow);
  const tr = editor.state.tr.replaceWith(from, to, table).scrollIntoView();
  let selectionPos = from + 1;
  let currentNode = table;

  while (currentNode.firstChild) {
    currentNode = currentNode.firstChild;
    selectionPos += 1;
  }

  tr.setSelection(TextSelection.near(tr.doc.resolve(selectionPos)));
  editor.view.dispatch(tr);

  return true;
}

const COMMAND_ITEMS: CommandItem[] = [
  {
    title: "Heading 1",
    description: "Big section heading",
    aliases: ["h1", "heading", "title", "large"],
    icon: Heading01Icon,
    command: ({ editor, range }) => {
      applyCommand({
        editor,
        range,
        run: (chain) => chain.setHeading({ level: 1 }),
      });
    },
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    aliases: ["h2", "heading", "section", "medium"],
    icon: Heading02Icon,
    command: ({ editor, range }) => {
      applyCommand({
        editor,
        range,
        run: (chain) => chain.setHeading({ level: 2 }),
      });
    },
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    aliases: ["h3", "heading", "small"],
    icon: Heading03Icon,
    command: ({ editor, range }) => {
      applyCommand({
        editor,
        range,
        run: (chain) => chain.setHeading({ level: 3 }),
      });
    },
  },
  {
    title: "Bullet List",
    description: "Create a simple bulleted list",
    aliases: ["bullet", "bullets", "list", "ul"],
    icon: LeftToRightListBulletIcon,
    command: ({ editor, range }) => {
      applyCommand({
        editor,
        range,
        run: (chain) => chain.toggleBulletList(),
      });
    },
  },
  {
    title: "Numbered List",
    description: "Create a numbered list",
    aliases: ["numbered", "ordered", "list", "ol", "1."],
    icon: LeftToRightListNumberIcon,
    command: ({ editor, range }) => {
      applyCommand({
        editor,
        range,
        run: (chain) => chain.toggleOrderedList(),
      });
    },
  },
  {
    title: "Task List",
    description: "Create a checklist with checkboxes",
    aliases: ["task", "todo", "checklist", "checkbox"],
    icon: CheckmarkSquare02Icon,
    command: ({ editor, range }) => {
      applyCommand({
        editor,
        range,
        run: (chain) => chain.toggleTaskList(),
      });
    },
  },
  {
    title: "Quote",
    description: "Highlight a quote or callout",
    aliases: ["quote", "blockquote", ">"],
    icon: LeftToRightBlockQuoteIcon,
    command: ({ editor, range }) => {
      applyCommand({
        editor,
        range,
        run: (chain) => chain.toggleBlockquote(),
      });
    },
  },
  {
    title: "Code",
    description: "Capture code in a monospaced block",
    aliases: ["code", "codeblock", "snippet", "```"],
    icon: FileCodeIcon,
    command: ({ editor, range }) => {
      applyCommand({
        editor,
        range,
        run: (chain) => chain.toggleCodeBlock(),
      });
    },
  },
  {
    title: "Table",
    description: "Insert a table with header cells",
    aliases: ["table", "grid", "cells", "spreadsheet"],
    icon: TableIcon,
    command: ({ editor }) => {
      insertTableCommand({
        editor,
        rows: 3,
        cols: 3,
        withHeaderRow: true,
      });
    },
  },
  {
    title: "Divider",
    description: "Insert a visual divider",
    aliases: ["divider", "rule", "line", "hr", "---"],
    icon: MinusSignIcon,
    command: ({ editor, range }) => {
      applyCommand({
        editor,
        range,
        run: (chain) => chain.setHorizontalRule(),
      });
    },
  },
];

interface CommandListProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
}

interface CommandListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

const CommandList = forwardRef<CommandListRef, CommandListProps>(
  ({ items, command }, ref) => {
    const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
    const listRef = useRef<HTMLDivElement | null>(null);
    const selectedIndex = items.findIndex((item) => item.title === selectedTitle);
    const activeIndex = selectedIndex >= 0 ? selectedIndex : 0;

    useEffect(() => {
      const activeButton = listRef.current?.querySelector<HTMLButtonElement>(
        `[data-command-index="${activeIndex}"]`
      );

      activeButton?.scrollIntoView({ block: "nearest" });
    }, [activeIndex]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) command(item);
      },
      [command, items]
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          event.stopPropagation();
          const nextIndex = (activeIndex + items.length - 1) % items.length;
          setSelectedTitle(items[nextIndex]?.title ?? null);
          return true;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          event.stopPropagation();
          const nextIndex = (activeIndex + 1) % items.length;
          setSelectedTitle(items[nextIndex]?.title ?? null);
          return true;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          selectItem(activeIndex);
          return true;
        }

        return false;
      },
    }));

    if (items.length === 0) return null;

    return (
      <div className="z-50 w-72 overflow-hidden rounded-2xl border border-border bg-background/98 p-1.5 shadow-xl backdrop-blur-sm">
        <div
          ref={listRef}
          className="max-h-[min(22rem,calc(100vh-10rem))] overflow-y-auto pr-0.5"
        >
        {items.map((item, index) => (
          <button
            key={item.title}
            data-command-index={index}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => selectItem(index)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
              index === activeIndex
                ? "bg-accent text-accent-foreground"
                : "text-foreground hover:bg-accent/60"
            }`}
          >
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg border ${
                index === activeIndex
                  ? "border-border/60 bg-background/70"
                  : "border-border/70 bg-muted/40"
              }`}
            >
              <HugeiconsIcon icon={item.icon} size={18} strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium leading-5">
                {item.title}
              </span>
              <span className="block text-xs leading-4 text-muted-foreground">
                {item.description}
              </span>
            </span>
          </button>
        ))}
        </div>
      </div>
    );
  }
);

CommandList.displayName = "CommandList";

const suggestion: Omit<SuggestionOptions<CommandItem, CommandItem>, "editor"> = {
  items: ({ query }) => {
    const search = query.trim().toLowerCase();
    if (!search) return COMMAND_ITEMS;

    return COMMAND_ITEMS.filter((item) => {
      const haystacks = [
        item.title.toLowerCase(),
        item.description.toLowerCase(),
        ...item.aliases.map((alias) => alias.toLowerCase()),
      ];

      return haystacks.some((value) => value.includes(search));
    });
  },
  command: ({ editor, range, props }) => {
    props.command({ editor, range });
  },
  allow: ({ state, range }) => {
    const $from = state.doc.resolve(range.from);
    return $from.parent.textContent.startsWith("/");
  },
  render: () => {
    let component: ReactRenderer<CommandListRef> | null = null;
    let popup: TippyInstance[] | null = null;

    return {
      onStart: (props) => {
        component = new ReactRenderer(CommandList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) return;

        popup = tippy("body", {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
        });
      },

      onUpdate(props) {
        component?.updateProps(props);

        if (!props.clientRect) return;

        popup?.[0]?.setProps({
          getReferenceClientRect: props.clientRect as () => DOMRect,
        });
      },

      onKeyDown(props) {
        if (props.event.key === "Escape") {
          popup?.[0]?.hide();
          return true;
        }

        return component?.ref?.onKeyDown(props) ?? false;
      },

      onExit() {
        popup?.[0]?.destroy();
        component?.destroy();
      },
    };
  },
};

export const SlashCommands = Extension.create({
  name: "slashCommands",

  addOptions() {
    return {
      suggestion: {
        ...suggestion,
        char: "/",
        allowSpaces: false,
        startOfLine: true,
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
