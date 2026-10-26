"use client";

import { useCallback, useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  BotIcon,
  Copy01Icon,
  Tick02Icon,
  CenterFocusIcon,
  LeftToRightListBulletIcon,
  Moon02Icon,
  QuillWrite02Icon,
  Sun01Icon,
  TextFontIcon,
} from "@hugeicons/core-free-icons";
import { useShallow } from "zustand/react/shallow";
import { startAgentBridge, stopAgentBridge, useAgentBridge } from "@/lib/agent-bridge";
import { useAlternativesUI } from "@/lib/alternatives-ui";
import { announce } from "@/lib/announce";
import { ALT_KEY, IS_MAC, cn } from "@/lib/utils";
import { docLabel, useEditorStore, type EditorFont } from "@/lib/editor-store";
import {
  COPY_MARKDOWN_EVENT,
  copyDocAsMarkdown,
} from "@/lib/use-editor-keyboard-shortcuts";
import { DocTabs } from "@/components/doc-tabs";
import { HelpDialog } from "@/components/help-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Each name is set in its own face, so the menu is its own preview.
const FONT_OPTIONS: { value: EditorFont; label: string; className: string }[] = [
  { value: "sans", label: "Clean", className: "font-sans" },
  { value: "classic", label: "Warm", className: "font-classic" },
  { value: "editorial", label: "Editorial", className: "font-editorial" },
  { value: "mono", label: "Code", className: "font-mono" },
];

const wordFormatter = new Intl.NumberFormat();

// The page background in each theme, as in app/layout.tsx's viewport.
const THEME_LIGHT = "#ffffff";
const THEME_DARK = "#0a0a0a";

const COPY_KEY = IS_MAC ? "⌘⇧C" : "Ctrl+Shift+C";

// Icons rest muted and darken on hover. A mode that's on gets the same
// pressed fill as the formatting toggles, a step stronger than hover.
const BAR_BUTTON =
  "text-muted-foreground aria-pressed:bg-foreground/10 aria-pressed:text-foreground dark:aria-pressed:bg-foreground/15";

const TOAST =
  "rounded-2xl border border-border bg-popover shadow-lg animate-in fade-in-0 duration-150";

/** Cut by characters, not CSS, so the closing quote hugs the ellipsis. */
function shortTitle(title: string) {
  return title.length > 32 ? `${title.slice(0, 31).trimEnd()}…` : title;
}

function Shortcut({ children }: { children: string }) {
  return <span className="opacity-60">{children}</span>;
}

const AGENT_LABEL = {
  off: "Connect agent",
  waiting: "Waiting for agent · click to stop",
  connected: "Agent connected · click to disconnect",
} as const;

export function Toolbar() {
  const { focusMode, font, toggleFocusMode, setFont, newDoc } = useEditorStore(
    useShallow((state) => ({
      focusMode: state.focusMode,
      font: state.font,
      toggleFocusMode: state.toggleFocusMode,
      setFont: state.setFont,
      newDoc: state.newDoc,
    }))
  );
  const words = useEditorStore(
    (state) => state.docs.find((d) => d.id === state.activeId)?.words ?? 0
  );
  const lastClosed = useEditorStore((state) => state.lastClosed);
  const undoClose = useEditorStore((state) => state.undoClose);
  const saveFailed = useEditorStore((state) => state.saveFailed);
  const agentStatus = useAgentBridge((state) => state.status);
  const panelOpen = useAlternativesUI((state) => state.panelOpen);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;

    const stored = localStorage.getItem("minimal-editor-theme");
    if (stored) return stored === "dark";

    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [expanded, setExpanded] = useState(false);
  const [showCopyConfirmation, setShowCopyConfirmation] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    document.documentElement.classList.toggle("dark", isDark);
    // Browser chrome follows the theme picked here, not only the system's.
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((meta) => meta.setAttribute("content", isDark ? THEME_DARK : THEME_LIGHT));

    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("minimal-editor-theme")) {
        setIsDark(e.matches);
        document.documentElement.classList.toggle("dark", e.matches);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [isDark]);

  useEffect(() => {
    const handleCopy = () => {
      setShowCopyConfirmation(true);
      announce("Copied as Markdown");
      const timeout = window.setTimeout(() => {
        setShowCopyConfirmation(false);
      }, 1200);

      return timeout;
    };

    let timeout: number | null = null;
    const listener = () => {
      if (timeout) {
        window.clearTimeout(timeout);
      }
      timeout = handleCopy();
    };

    window.addEventListener(COPY_MARKDOWN_EVENT, listener);
    return () => {
      window.removeEventListener(COPY_MARKDOWN_EVENT, listener);
      if (timeout) {
        window.clearTimeout(timeout);
      }
    };
  }, []);

  const toggleTheme = useCallback(() => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("minimal-editor-theme", next ? "dark" : "light");
  }, [isDark]);

  const togglePanel = useCallback(() => {
    const ui = useAlternativesUI.getState();
    if (ui.panelOpen) {
      ui.closePanel();
      useEditorStore.getState().editor?.commands.focus(null, { scrollIntoView: false });
    } else {
      ui.openPanel();
    }
  }, []);

  const handleCopyMarkdown = useCallback(async () => {
    const { editor } = useEditorStore.getState();
    if (editor) await copyDocAsMarkdown(editor);
  }, []);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between bg-background px-4 py-3 sm:px-2"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocus={() => setExpanded(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setExpanded(false);
        }
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 pr-3">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-label="Toggle toolbar"
          aria-expanded={expanded}
          className="flex items-center justify-center text-muted-foreground sm:hidden"
        >
          <HugeiconsIcon
            icon={QuillWrite02Icon}
            size={18}
            strokeWidth={1.5}
          />
        </button>

        {/* Same 32px box as the buttons, so both ends of the bar sit 16px in. */}
        <div
          className={cn(
            "hidden size-8 shrink-0 items-center justify-center transition-colors duration-200 sm:flex",
            expanded ? "text-muted-foreground" : "text-muted-foreground/30"
          )}
        >
          <HugeiconsIcon
            icon={QuillWrite02Icon}
            size={18}
            strokeWidth={1.5}
          />
        </div>
        <DocTabs dimmed={!expanded} />
      </div>

      <div
        className={cn(
          "absolute right-4 top-1/2 flex items-center gap-1 rounded-2xl border border-border bg-popover p-1 shadow-lg transition-all duration-200 sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none",
          expanded
            ? "translate-y-[-50%] opacity-100 sm:translate-y-0"
            : "pointer-events-none translate-y-[-60%] opacity-0 sm:-translate-y-1"
        )}
      >
        <span className="hidden px-2 text-xs tabular-nums text-muted-foreground sm:inline">
          {wordFormatter.format(words)} {words === 1 ? "word" : "words"}
        </span>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={togglePanel}
                aria-label="Alternatives"
                aria-pressed={panelOpen}
                className={BAR_BUTTON}
              />
            }
          >
            <HugeiconsIcon icon={LeftToRightListBulletIcon} size={16} strokeWidth={1.5} />
          </TooltipTrigger>
          <TooltipContent>
            Alternatives <Shortcut>{`${ALT_KEY}↵`}</Shortcut>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={newDoc}
                aria-label="New doc"
                className={BAR_BUTTON}
              />
            }
          >
            <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={1.5} />
          </TooltipTrigger>
          <TooltipContent>
            New doc <Shortcut>{`${ALT_KEY}N`}</Shortcut>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCopyMarkdown}
                aria-label="Copy as Markdown"
                className={BAR_BUTTON}
              />
            }
          >
            <HugeiconsIcon icon={Copy01Icon} size={16} strokeWidth={1.5} />
          </TooltipTrigger>
          <TooltipContent>
            Copy as Markdown <Shortcut>{COPY_KEY}</Shortcut>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-4" />

        <Popover>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Change font"
                      className={BAR_BUTTON}
                    />
                  }
                >
                  <HugeiconsIcon icon={TextFontIcon} size={16} strokeWidth={1.5} />
                </PopoverTrigger>
              }
            />
            <TooltipContent>Font</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-40 gap-0 p-1" side="bottom" align="end">
            {FONT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={font === opt.value}
                onClick={() => setFont(opt.value)}
                className="flex h-8 w-full items-center justify-between gap-2 rounded-xl px-2.5 text-sm text-foreground outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className={opt.className}>{opt.label}</span>
                {font === opt.value ? (
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    size={14}
                    strokeWidth={2}
                    className="text-muted-foreground"
                  />
                ) : null}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggleFocusMode}
                aria-label="Focus mode"
                aria-pressed={focusMode}
                className={BAR_BUTTON}
              />
            }
          >
            <HugeiconsIcon icon={CenterFocusIcon} size={16} strokeWidth={1.5} />
          </TooltipTrigger>
          <TooltipContent>Focus mode</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggleTheme}
                aria-label={isDark ? "Light mode" : "Dark mode"}
                className={BAR_BUTTON}
              />
            }
          >
            <HugeiconsIcon icon={isDark ? Sun01Icon : Moon02Icon} size={16} strokeWidth={1.5} />
          </TooltipTrigger>
          <TooltipContent>{isDark ? "Light mode" : "Dark mode"}</TooltipContent>
        </Tooltip>

        <HelpDialog triggerClassName={BAR_BUTTON} />
      </div>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={agentStatus === "off" ? startAgentBridge : stopAgentBridge}
              aria-label={AGENT_LABEL[agentStatus]}
              aria-pressed={agentStatus !== "off"}
              className={cn(
                // The dot carries the status, so the icon stays muted even when on.
                "relative ml-1 text-muted-foreground transition-opacity duration-200",
                // Hidden with the rest of the toolbar unless an agent is on.
                agentStatus === "off" && !expanded && "pointer-events-none opacity-0"
              )}
            />
          }
        >
          <HugeiconsIcon icon={BotIcon} size={16} strokeWidth={1.5} />
          {agentStatus !== "off" ? (
            <span
              aria-hidden
              className={cn(
                "absolute top-1.5 right-1.5 size-1.5 rounded-full",
                agentStatus === "connected"
                  ? "bg-[var(--link)]"
                  : "border border-muted-foreground"
              )}
            />
          ) : null}
        </TooltipTrigger>
        <TooltipContent>{AGENT_LABEL[agentStatus]}</TooltipContent>
      </Tooltip>

      {/* Toasts stack at the bottom centre, so two at once never overlap. */}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-60 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col items-center gap-2 text-sm">
        {saveFailed ? (
          <div role="alert" className={cn(TOAST, "pointer-events-auto max-w-sm px-4 py-2.5")}>
            <span className="font-medium text-destructive">Not saved.</span>{" "}
            <span className="text-muted-foreground">
              This browser&apos;s storage is full. Download a backup from Help,
              then close docs you don&apos;t need.
            </span>
          </div>
        ) : null}

        {showCopyConfirmation ? (
          <div className={cn(TOAST, "px-4 py-1.5 text-muted-foreground")}>
            Copied as Markdown
          </div>
        ) : null}

        {lastClosed ? (
          <div
            role="status"
            className={cn(TOAST, "pointer-events-auto flex items-center gap-2 py-1 pr-1 pl-4")}
          >
            <span className="text-muted-foreground">
              Closed “{shortTitle(docLabel(lastClosed.doc))}”
            </span>
            <Button variant="ghost" size="xs" onClick={undoClose}>
              Undo
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
