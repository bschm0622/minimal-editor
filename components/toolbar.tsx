"use client";

import { useCallback, useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Copy01Icon,
  FloppyDiskIcon,
  FolderOpenIcon,
  CenterFocusIcon,
  Moon02Icon,
  QuillWrite02Icon,
  Sun01Icon,
  TextFontIcon,
} from "@hugeicons/core-free-icons";
import { useEditorStore, type EditorFont } from "@/lib/editor-store";
import {
  copyStoreContentAsMarkdown,
  MANUAL_FILE_SAVE_EVENT,
  openMarkdownFileIntoStore,
  saveStoreContentToFile,
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
  PopoverTrigger,
} from "@/components/ui/popover";

const FONT_OPTIONS: { value: EditorFont; label: string; sample: string }[] = [
  { value: "sans", label: "Sans Serif", sample: "Aa" },
  { value: "serif", label: "Serif", sample: "Aa" },
  { value: "mono", label: "Monospace", sample: "Aa" },
];

export function Toolbar() {
  const { fileHandle, focusMode, font, toggleFocusMode, setFont } =
    useEditorStore();
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
    if (await saveStoreContentToFile()) {
      setExpanded(false);
    }
  }, []);

  const handleCopyMarkdown = useCallback(async () => {
    await copyStoreContentAsMarkdown();
  }, []);

  const handleOpenFile = useCallback(async () => {
    if (await openMarkdownFileIntoStore()) {
      setExpanded(false);
    }
  }, []);

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
                onClick={handleOpenFile}
                aria-label="Open file"
              />
            }
          >
            <HugeiconsIcon icon={FolderOpenIcon} size={18} strokeWidth={1.5} />
          </TooltipTrigger>
          <TooltipContent>Open file</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleSave}
                aria-label={fileHandle ? "Save to file" : "Save file"}
              />
            }
          >
            <HugeiconsIcon icon={FloppyDiskIcon} size={18} strokeWidth={1.5} />
          </TooltipTrigger>
          <TooltipContent>
            {fileHandle ? "Save to file" : "Save file"}
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
          <TooltipContent>Copy as Markdown</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-5" />

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
            <TooltipContent>Font</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-44 p-1.5" side="bottom" align="end">
            {FONT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFont(opt.value)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  font === opt.value
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-accent/50"
                }`}
              >
                <span
                  className={`text-base ${
                    opt.value === "serif"
                      ? "font-serif"
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
          <TooltipContent>Focus mode</TooltipContent>
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
          <TooltipContent>{isDark ? "Light mode" : "Dark mode"}</TooltipContent>
        </Tooltip>
      </div>

      <div
        className={`pointer-events-none absolute right-4 top-full mt-2 rounded-full border border-border bg-background/95 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur-sm transition-all duration-200 ${
          showSaveConfirmation
            ? "translate-y-0 opacity-100"
            : "-translate-y-1 opacity-0"
        }`}
      >
        Saved to file
      </div>
    </header>
  );
}
