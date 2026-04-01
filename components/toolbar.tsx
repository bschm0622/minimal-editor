"use client";

import { useCallback, useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Copy01Icon,
  FloppyDiskIcon,
  FolderOpenIcon,
  GitCompareIcon,
  CenterFocusIcon,
  HelpCircleIcon,
  Moon02Icon,
  QuillWrite02Icon,
  Sun01Icon,
  TextFontIcon,
} from "@hugeicons/core-free-icons";
import { useEditorStore, type EditorFont } from "@/lib/editor-store";
import {
  copyCurrentDraftAsMarkdown,
  MANUAL_FILE_SAVE_EVENT,
  openMarkdownFileIntoStore,
  saveCurrentDraftToFile,
  saveCurrentDraftToNewFile,
} from "@/lib/editor-file-actions";
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
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

const FONT_OPTIONS: { value: EditorFont; label: string; sample: string }[] = [
  { value: "sans", label: "Clean", sample: "Aa" },
  { value: "classic", label: "Warm", sample: "Aa" },
  { value: "editorial", label: "Editorial", sample: "Ag" },
  { value: "mono", label: "Code", sample: "Aa" },
];

const HELP_SHORTCUTS = [
  { key: "/", description: "Open the block menu" },
  { key: "#, ##, ###", description: "Create headings" },
  { key: "Cmd/Ctrl + O", description: "Open a Markdown file" },
  { key: "Cmd/Ctrl + S", description: "Save to file" },
  { key: "Cmd/Ctrl + Shift + S", description: "Save as..." },
  { key: "Cmd/Ctrl + Shift + C", description: "Copy the full draft as Markdown" },
];

const HELP_FEATURES = [
  "Your draft autosaves in this browser.",
  "Paste Markdown to turn it into rich text.",
  "Use / to insert headings, lists, quotes, code blocks, tables, and dividers.",
  "Select text to open the bubble menu for inline formatting, links, and copy-as-Markdown.",
  "The Save button shows whether your file is up to date.",
  "Files only change when you use Save or Save as....",
  "After you choose a file, Save keeps writing to that file in this tab.",
  "Use Save as... to switch files.",
];

export function Toolbar() {
  const {
    fileHandle,
    focusMode,
    font,
    fileDirty,
    compareMode,
    toggleFocusMode,
    setFont,
    setCompareMode,
  } = useEditorStore();
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;

    const stored = localStorage.getItem("minimal-editor-theme");
    if (stored) return stored === "dark";

    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [expanded, setExpanded] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);

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
    const handleManualSave = () => {
      setShowSaveConfirmation(true);
      const timeout = window.setTimeout(() => {
        setShowSaveConfirmation(false);
      }, 1200);

      return timeout;
    };

    let timeout: number | null = null;
    const listener = () => {
      if (timeout) {
        window.clearTimeout(timeout);
      }
      timeout = handleManualSave();
    };

    window.addEventListener(MANUAL_FILE_SAVE_EVENT, listener);
    return () => {
      window.removeEventListener(MANUAL_FILE_SAVE_EVENT, listener);
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

  const handleSave = useCallback(async () => {
    if (await saveCurrentDraftToFile()) {
      setExpanded(false);
    }
  }, []);

  const handleSaveAs = useCallback(async () => {
    if (await saveCurrentDraftToNewFile()) {
      setExpanded(false);
    }
  }, []);

  const handleCopyMarkdown = useCallback(async () => {
    await copyCurrentDraftAsMarkdown();
  }, []);

  const handleOpenFile = useCallback(async () => {
    if (await openMarkdownFileIntoStore()) {
      setExpanded(false);
    }
  }, []);

  const fileStatusClassName = !fileHandle
    ? "hidden"
    : fileDirty
      ? "bg-amber-500"
      : "bg-emerald-500";

  const fileStatusLabel = !fileHandle
    ? "No file selected"
    : fileDirty
      ? "File has unsaved changes"
      : "File is up to date";
  const tooltipFontClassName =
    font === "editorial"
      ? "font-editorial"
      : font === "classic"
        ? "font-classic"
        : font === "mono"
          ? "font-mono"
          : "font-sans";

  const showFileActions = !compareMode;
  const showFocusModeToggle = !compareMode;

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between px-4 py-3"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div className="flex items-center">
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
          className={`hidden items-center justify-center transition-all duration-200 sm:flex ${
            expanded ? "text-muted-foreground" : "text-muted-foreground/30"
          }`}
        >
          <HugeiconsIcon
            icon={QuillWrite02Icon}
            size={18}
            strokeWidth={1.5}
          />
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  aria-label={fileStatusLabel}
                  className={`ml-2 size-2 rounded-full transition-colors ${fileStatusClassName}`}
                />
              }
            />
            <TooltipContent className={tooltipFontClassName}>
              {fileStatusLabel}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Action buttons */}
      <div
        className={`absolute right-4 top-1/2 flex items-center gap-1 rounded-xl border border-border bg-background/95 p-1.5 shadow-lg backdrop-blur-sm transition-all duration-200 sm:static sm:bg-background/80 sm:shadow-none ${
          expanded
            ? "translate-y-[-50%] opacity-100 sm:translate-y-0"
            : "pointer-events-none translate-y-[-60%] opacity-0 sm:-translate-y-1"
        }`}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setCompareMode(!compareMode)}
                aria-label="Toggle compare mode"
                className={compareMode ? "bg-accent" : ""}
              />
            }
          >
            <HugeiconsIcon
              icon={GitCompareIcon}
              size={18}
              strokeWidth={1.5}
            />
          </TooltipTrigger>
          <TooltipContent className={tooltipFontClassName}>
            Compare versions
          </TooltipContent>
        </Tooltip>

        {showFileActions ? (
          <>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleOpenFile}
                    aria-label="Open file"
                  />
                }
              >
                <HugeiconsIcon icon={FolderOpenIcon} size={18} strokeWidth={1.5} />
              </TooltipTrigger>
              <TooltipContent className={tooltipFontClassName}>
                Open file
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleSave}
                    aria-label={fileHandle ? "Save to current file" : "Save as"}
                    className={
                      fileDirty
                        ? "text-amber-500 dark:text-amber-400"
                        : fileHandle
                          ? "text-emerald-600 dark:text-emerald-400"
                          : ""
                    }
                  />
                }
              >
                <HugeiconsIcon icon={FloppyDiskIcon} size={18} strokeWidth={1.5} />
              </TooltipTrigger>
              <TooltipContent className={tooltipFontClassName}>
                {fileHandle
                  ? fileDirty
                    ? "Unsaved file changes"
                    : "Saved to file"
                  : "Save as..."}
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
          </>
        ) : null}

        {/* Font picker */}
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

        {showFocusModeToggle ? (
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
        ) : null}

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

        <Popover>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" aria-label="Help" />
                  }
                >
                  <HugeiconsIcon
                    icon={HelpCircleIcon}
                    size={18}
                    strokeWidth={1.5}
                  />
                </PopoverTrigger>
              }
            />
            <TooltipContent className={tooltipFontClassName}>
              Help
            </TooltipContent>
          </Tooltip>
          <PopoverContent
            className="w-[min(24rem,calc(100vw-1rem))] gap-3 p-3"
            side="bottom"
            align="end"
          >
            <PopoverHeader className="gap-1">
              <PopoverTitle>Help</PopoverTitle>
              <PopoverDescription>
                A few useful rules, kept out of the way.
              </PopoverDescription>
            </PopoverHeader>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Shortcuts
              </p>
              <div className="space-y-2">
                {HELP_SHORTCUTS.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <span className="text-foreground">{item.description}</span>
                    <code className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {item.key}
                    </code>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                File behavior
              </p>
              <div className="space-y-2 text-sm text-muted-foreground">
                {HELP_FEATURES.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {fileHandle
                    ? "Save will write to the current file."
                    : "Save will ask you to choose a file."}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fileHandle
                    ? "Use Save as... if you want to switch files. Draft autosave stays local."
                    : "After that, Save keeps writing to the same file in this tab."}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleSaveAs}>
                Save as...
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div
        className={`pointer-events-none fixed right-3 z-60 rounded-full border border-border bg-background/95 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur-sm transition-all duration-200 sm:right-4 ${
          showSaveConfirmation
            ? "translate-y-0 opacity-100"
            : "-translate-y-2 opacity-0"
        }`}
        style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        Saved to file
      </div>
    </header>
  );
}
