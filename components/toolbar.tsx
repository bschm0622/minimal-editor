"use client";

import { useCallback, useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  BotIcon,
  Copy01Icon,
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
import { ALT_KEY, cn } from "@/lib/utils";
import { useEditorStore, type EditorFont } from "@/lib/editor-store";
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

const FONT_OPTIONS: { value: EditorFont; label: string; sample: string }[] = [
  { value: "sans", label: "Clean", sample: "Aa" },
  { value: "classic", label: "Warm", sample: "Aa" },
  { value: "editorial", label: "Editorial", sample: "Ag" },
  { value: "mono", label: "Code", sample: "Aa" },
];

const wordFormatter = new Intl.NumberFormat();

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

  const tooltipFontClassName =
    font === "editorial"
      ? "font-editorial"
      : font === "classic"
        ? "font-classic"
        : font === "mono"
          ? "font-mono"
          : "font-sans";

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between bg-background px-4 py-3"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocus={() => setExpanded(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setExpanded(false);
        }
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 pr-3">
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

        <div
          className={`hidden shrink-0 items-center justify-center transition-all duration-200 sm:flex ${
            expanded ? "text-muted-foreground" : "text-muted-foreground/30"
          }`}
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
        className={`absolute right-4 top-1/2 flex items-center gap-1 rounded-xl border border-border bg-background/95 p-1.5 shadow-lg backdrop-blur-sm transition-all duration-200 sm:static sm:bg-background/80 sm:shadow-none ${
          expanded
            ? "translate-y-[-50%] opacity-100 sm:translate-y-0"
            : "pointer-events-none translate-y-[-60%] opacity-0 sm:-translate-y-1"
        }`}
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
                className={panelOpen ? "bg-accent" : ""}
              />
            }
          >
            <HugeiconsIcon icon={LeftToRightListBulletIcon} size={18} strokeWidth={1.5} />
          </TooltipTrigger>
          <TooltipContent className={tooltipFontClassName}>
            Alternatives <span className="opacity-60">{ALT_KEY}↵</span>
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
              />
            }
          >
            <HugeiconsIcon icon={Add01Icon} size={18} strokeWidth={1.5} />
          </TooltipTrigger>
          <TooltipContent className={tooltipFontClassName}>
            New doc
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
              />
            }
          >
            <HugeiconsIcon icon={Copy01Icon} size={18} strokeWidth={1.5} />
          </TooltipTrigger>
          <TooltipContent className={tooltipFontClassName}>
            Copy as Markdown
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-5" />

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
                    />
                  }
                >
                  <HugeiconsIcon
                    icon={TextFontIcon}
                    size={18}
                    strokeWidth={1.5}
                  />
                </PopoverTrigger>
              }
            />
            <TooltipContent className={tooltipFontClassName}>
              Font
            </TooltipContent>
          </Tooltip>
          <PopoverContent className="w-44 gap-0 p-1.5" side="bottom" align="end">
            {FONT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFont(opt.value)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                  font === opt.value
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-accent/50"
                }`}
              >
                <span
                  className={`text-base ${
                    opt.value === "classic"
                      ? "font-classic"
                      : opt.value === "editorial"
                        ? "font-editorial"
                      : opt.value === "mono"
                        ? "font-mono"
                        : "font-sans"
                  }`}
                >
                  {opt.sample}
                </span>
                <span>{opt.label}</span>
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
                  aria-label="Toggle focus mode"
                  className={focusMode ? "bg-accent" : ""}
                />
              }
            >
              <HugeiconsIcon
                icon={CenterFocusIcon}
                size={18}
                strokeWidth={1.5}
              />
            </TooltipTrigger>
            <TooltipContent className={tooltipFontClassName}>
              Focus mode
            </TooltipContent>
          </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggleTheme}
                aria-label="Toggle theme"
              />
            }
          >
            <HugeiconsIcon
              icon={isDark ? Sun01Icon : Moon02Icon}
              size={18}
              strokeWidth={1.5}
            />
          </TooltipTrigger>
          <TooltipContent className={tooltipFontClassName}>
            {isDark ? "Light mode" : "Dark mode"}
          </TooltipContent>
        </Tooltip>

        <HelpDialog tooltipClassName={tooltipFontClassName} />
      </div>

      <div
        className={`pointer-events-none fixed right-3 z-60 rounded-full border border-border bg-background/95 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur-sm transition-all duration-200 sm:right-4 ${
          showCopyConfirmation
            ? "translate-y-0 opacity-100"
            : "-translate-y-2 opacity-0"
        }`}
        style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        Copied as Markdown
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
                "relative ml-1 transition-all duration-200",
                agentStatus === "connected"
                  ? "text-foreground"
                  : "text-muted-foreground",
                // Hidden with the rest of the toolbar unless an agent is on.
                agentStatus === "off" && !expanded && "pointer-events-none opacity-0"
              )}
            />
          }
        >
          <HugeiconsIcon icon={BotIcon} size={18} strokeWidth={1.5} />
          {agentStatus !== "off" ? (
            <span
              aria-hidden
              className={cn(
                "absolute top-1 right-1 size-1.5 rounded-full",
                agentStatus === "connected"
                  ? "bg-[var(--link)]"
                  : "border border-muted-foreground bg-background"
              )}
            />
          ) : null}
        </TooltipTrigger>
        <TooltipContent className={tooltipFontClassName}>
          {AGENT_LABEL[agentStatus]}
        </TooltipContent>
      </Tooltip>

      {saveFailed ? (
        <div
          role="alert"
          className="fixed bottom-12 left-4 z-60 max-w-xs rounded-xl border border-destructive/40 bg-background px-3 py-2 text-sm text-destructive shadow-lg"
        >
          Not saved: this browser&apos;s storage is full. Download a backup from
          Help, then close docs you don&apos;t need.
        </div>
      ) : null}

      {lastClosed ? (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-60 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-background/95 py-1 pr-1 pl-4 text-sm text-muted-foreground shadow-lg backdrop-blur-sm"
        >
          <span className="max-w-56 truncate">
            Closed “{lastClosed.doc.title || "Untitled"}”
          </span>
          <Button variant="ghost" size="xs" onClick={undoClose}>
            Undo
          </Button>
        </div>
      ) : null}
    </header>
  );
}
