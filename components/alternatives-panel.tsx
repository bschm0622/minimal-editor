"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { BotIcon, Cancel01Icon } from "@hugeicons/core-free-icons";
import {
  alternativeAt,
  inlineToMarkdown,
  inlineToText,
  listAlternatives,
  resolveAlternative,
  resolveAllAlternatives,
  showVariant,
  textToInline,
  updateAlternative,
  withoutVersion,
  withVersion,
  withVersionContent,
} from "@/lib/alternatives";
import { pruneFreshVersion, useAlternativesUI } from "@/lib/alternatives-ui";
import { announce } from "@/lib/announce";
import { useEditorStore } from "@/lib/editor-store";
import { ALT_KEY, cn, MOD_KEY } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const FONT_CLASS = {
  sans: "font-sans",
  classic: "font-classic",
  editorial: "font-editorial",
  mono: "font-mono",
} as const;

interface Version {
  text: string;
  ai: boolean;
}

interface Current {
  id: string;
  active: number;
  versions: Version[];
}

interface AtCursor {
  id: string;
  active: number;
  count: number;
  ai: boolean;
  gap: boolean;
}

const EMPTY = { current: null, all: [], at: null };

function atCursor(editor: Editor): AtCursor | null {
  const range = alternativeAt(editor.state);
  return range
    ? {
        id: range.id,
        active: range.active,
        count: range.variants.length,
        ai: range.ai[range.active],
        gap: range.gap,
      }
    : null;
}

function useAlternativesState(editor: Editor | null, panelOpen: boolean) {
  return (
    useEditorState({
      editor,
      selector: ({ editor: e }) => {
        if (!e) return EMPTY;
        // Closed, the panel only tracks the cursor, for screen reader announcements.
        if (!panelOpen) return { ...EMPTY, at: atCursor(e) };
        const all = listAlternatives(e.state);
        const at = alternativeAt(e.state);
        const range = at && all.find((r) => r.id === at.id);
        const current: Current | null = range
          ? {
              id: range.id,
              active: range.active,
              versions: range.variants.map((content, i) => ({
                text: inlineToText(content),
                ai: range.ai[i],
              })),
            }
          : null;
        return {
          current,
          at: atCursor(e),
          all: all.map((r) => ({
            id: r.id,
            to: r.to,
            label: inlineToText(r.variants[r.active]).trim() || inlineToText(r.variants[0]).trim(),
            dimmed: !r.variants[r.active].length,
          })),
        };
      },
    }) ?? EMPTY
  );
}

function Bullet({ active, ai }: { active: boolean; ai: boolean }) {
  return (
    <span
      className={cn(
        "flex h-5 w-3 shrink-0 items-center justify-center",
        active ? "text-[var(--link)]" : "text-muted-foreground/60"
      )}
      aria-hidden
    >
      {ai ? (
        <HugeiconsIcon icon={BotIcon} size={12} strokeWidth={2} />
      ) : (
        <span className={cn("rounded-full bg-current", active ? "size-1.5" : "size-1")} />
      )}
    </span>
  );
}

function VersionLine({
  editor,
  current,
  index,
}: {
  editor: Editor;
  current: Current;
  index: number;
}) {
  const version = current.versions[index];
  const active = current.active === index;
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  // Spaces around the text when editing began, kept so sentences don't run together.
  const edgesRef = useRef({ lead: "", trail: "" });
  const focus = useAlternativesUI((state) => state.focus);
  const { setFocus, openPanel, closePanel, setFresh } = useAlternativesUI.getState();

  useEffect(() => {
    const textarea = ref.current;
    if (!textarea || focus?.id !== current.id || focus.index !== index) return;
    textarea.focus();
    if (focus.caret === "all") {
      textarea.select();
    } else {
      const at = focus.caret === "start" ? 0 : textarea.value.length;
      textarea.setSelectionRange(at, at);
    }
    setFocus(null);
  }, [focus, current.id, index, setFocus]);

  const apply = (value: string) => {
    const { lead, trail } = edgesRef.current;
    const content = value.trim() ? textToInline(editor.schema, lead + value.trim() + trail) : [];
    // The original can be reworded, not emptied.
    if (index === 0 && !content.length) return;
    updateAlternative(editor, current.id, (attrs) => {
      const next = withVersionContent(attrs, index, content);
      // A new line shows in the doc once it has text, not while it's blank.
      return content.length ? { ...next, active: index } : next;
    });
  };

  const handleFocus = () => {
    const source = version.text.trim() ? version.text : current.versions[0].text;
    edgesRef.current = {
      lead: source.match(/^\s*/)?.[0] ?? "",
      trail: source.match(/\s*$/)?.[0] ?? "",
    };
    // Markdown only while editing, so bold and links survive a rewrite.
    const latest = listAlternatives(editor.state).find((r) => r.id === current.id);
    setDraft(inlineToMarkdown(editor.schema, latest?.variants[index] ?? []));
    if (!active && version.text.trim()) showVariant(editor, current.id, index);
  };

  const backToText = () => {
    closePanel();
    editor.commands.focus(null, { scrollIntoView: false });
  };

  /** Drops a blank line added earlier, and says where this line ends up (null: it was the one dropped). */
  const pruneOther = () => {
    const removed = pruneFreshVersion();
    if (removed?.id !== current.id) return index;
    if (removed.index === index) return null;
    return removed.index < index ? index - 1 : index;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    const textarea = event.currentTarget;
    const count = current.versions.length;
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 24;
    const oneLine = textarea.scrollHeight <= lineHeight * 1.5;

    if (event.key === "Enter" && event.altKey) {
      event.preventDefault();
      backToText();
    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      // Keep this version (or, on a blank line, the one on screen) and go back to writing.
      event.preventDefault();
      const at = pruneOther();
      resolveAlternative(editor, current.id, at ?? "shown");
      backToText();
    } else if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      // An empty line is already a new version waiting to be typed.
      if (!textarea.value.trim()) return;
      const at = pruneOther();
      if (at === null) return;
      updateAlternative(editor, current.id, (attrs) => ({
        ...withVersion(attrs, at + 1, []),
        active: attrs.active > at ? attrs.active + 1 : attrs.active,
      }));
      setFresh({ id: current.id, index: at + 1 });
      openPanel({ id: current.id, index: at + 1 });
    } else if (event.key === "Escape") {
      event.preventDefault();
      backToText();
    } else if (
      event.key === "ArrowUp" &&
      index > 0 &&
      (oneLine || textarea.selectionEnd === 0)
    ) {
      event.preventDefault();
      openPanel({ id: current.id, index: index - 1, caret: "end" });
    } else if (
      event.key === "ArrowDown" &&
      index < count - 1 &&
      (oneLine || textarea.selectionStart === textarea.value.length)
    ) {
      event.preventDefault();
      openPanel({ id: current.id, index: index + 1, caret: "end" });
    } else if (event.key === "Backspace" && !textarea.value && index > 0) {
      event.preventDefault();
      const { fresh } = useAlternativesUI.getState();
      if (fresh?.id === current.id) {
        setFresh(
          fresh.index === index ? null : { ...fresh, index: fresh.index > index ? fresh.index - 1 : fresh.index }
        );
      }
      updateAlternative(editor, current.id, (attrs) => withoutVersion(attrs, index));
      if (count > 2) openPanel({ id: current.id, index: index - 1, caret: "end" });
      else editor.commands.focus(null, { scrollIntoView: false });
    }
  };

  const removed = !version.text.trim();
  const fresh = useAlternativesUI(
    (state) => state.fresh?.id === current.id && state.fresh.index === index
  );

  return (
    <li className="flex items-start gap-2">
      <Bullet active={active} ai={version.ai} />
      <div className="min-w-0 flex-1">
        <textarea
          ref={ref}
          rows={1}
          value={draft ?? version.text.trim()}
          placeholder={index === 0 ? "" : fresh ? "New version" : "dimmed"}
          aria-label={[
            index === 0 ? "Original" : `Version ${index + 1}`,
            active && "showing",
            version.ai && "suggested by AI",
          ]
            .filter(Boolean)
            .join(", ")}
          onFocus={handleFocus}
          onBlur={() => setDraft(null)}
          onChange={(event) => {
            setDraft(event.target.value);
            apply(event.target.value);
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            "field-sizing-content block w-full resize-none bg-transparent leading-5 outline-none placeholder:italic",
            active
              ? "text-foreground placeholder:text-foreground/70"
              : "text-muted-foreground placeholder:text-muted-foreground",
            removed && draft === null && "italic"
          )}
        />
      </div>
    </li>
  );
}

function QuietButton({
  children,
  primary,
  onClick,
}: {
  children: string;
  /** The likely next step: a shade stronger than the rest. */
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mx-1 rounded-md px-1 py-0.5 font-medium transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
        primary ? "text-foreground/85" : "text-muted-foreground"
      )}
    >
      {children}
    </button>
  );
}

export function AlternativesPanel() {
  const editor = useEditorStore((state) => state.editor);
  const font = useEditorStore((state) => state.font);
  const panelOpen = useAlternativesUI((state) => state.panelOpen);
  const { closePanel } = useAlternativesUI.getState();
  const { current, all, at } = useAlternativesState(editor, panelOpen);
  const currentId = current?.id ?? null;

  // Tell screen readers when the cursor reaches text with versions, and which one is showing.
  useEffect(() => {
    if (!at) return;
    announce(
      [
        `Version ${at.active + 1} of ${at.count}`,
        at.active === 0 && "the original",
        at.ai && "suggested by AI",
        at.gap && "dimmed",
      ]
        .filter(Boolean)
        .join(", ")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at?.id, at?.active]);

  // Esc closes the panel wherever focus is; lines and the editor handle it first.
  useEffect(() => {
    if (!panelOpen || !editor) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      closePanel();
      editor.commands.focus(null, { scrollIntoView: false });
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [panelOpen, editor, closePanel]);

  // A blank line added to one alternative goes once you move to another.
  useEffect(() => {
    const { fresh } = useAlternativesUI.getState();
    if (fresh && fresh.id !== currentId) pruneFreshVersion();
  }, [currentId]);

  if (!editor) return null;

  if (!panelOpen) return null;

  const jumpTo = (to: number) => {
    editor.chain().focus().setTextSelection(to).scrollIntoView().run();
  };

  const backToText = () => editor.commands.focus(null, { scrollIntoView: false });

  return (
    <aside
      className={cn(
        "fixed top-14 right-0 bottom-0 z-40 flex w-full flex-col bg-background px-5 pt-3 pb-4 text-sm sm:w-72"
      )}
      aria-label="Alternatives"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs text-muted-foreground">{current ? "Versions" : "Alternatives"}</h2>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Close"
          className="-mr-1.5 text-muted-foreground"
          onClick={() => {
            closePanel();
            backToText();
          }}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2} />
        </Button>
      </div>
      <div className={cn("flex-1 overflow-y-auto", FONT_CLASS[font])}>
        {current ? (
          <ul key={current.id} className="flex flex-col gap-2.5">
            {current.versions.map((_, index) => (
              <VersionLine key={index} editor={editor} current={current} index={index} />
            ))}
          </ul>
        ) : all.length ? (
          <ul className="flex flex-col gap-2.5">
            {all.map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <Bullet active={false} ai={false} />
                <button
                  type="button"
                  onClick={() => jumpTo(item.to)}
                  className={cn(
                    "min-w-0 flex-1 truncate rounded-sm text-left leading-5 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
                    item.dimmed && "italic"
                  )}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="leading-5 text-muted-foreground">
            No alternatives yet. Select text and press {ALT_KEY}↵ to add one.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-xs">
        {current ? (
          <>
            <QuietButton
              primary
              onClick={() => {
                resolveAlternative(editor, current.id, "shown");
                backToText();
              }}
            >
              Keep
            </QuietButton>
            {current.active !== 0 ? (
              <QuietButton
                onClick={() => {
                  resolveAlternative(editor, current.id, "original");
                  backToText();
                }}
              >
                Use original
              </QuietButton>
            ) : null}
            <span className="ml-auto text-muted-foreground">
              ↵ adds · {MOD_KEY}↵ keeps
            </span>
          </>
        ) : (
          <>
            {all.length ? (
              <>
                <QuietButton
                  primary
                  onClick={() => {
                    resolveAllAlternatives(editor, "shown");
                    backToText();
                  }}
                >
                  Keep all
                </QuietButton>
                <QuietButton
                  onClick={() => {
                    resolveAllAlternatives(editor, "original");
                    backToText();
                  }}
                >
                  Use originals
                </QuietButton>
              </>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}
